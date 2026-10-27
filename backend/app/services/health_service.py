"""Code health scan over a repository's indexed text files."""
from __future__ import annotations

import re
import time
from pathlib import Path

from app.domain.exceptions import RepositoryNotFoundError
from app.domain.models import HealthFinding, HealthReport, Language, LargeFile
from app.domain.ports import CodeParserPort, FileMetadataRepositoryPort
from app.services.health_rules import (
    COMMENT_TOKEN, CONNECTION_STRING, FILE_SUPPRESSION, FILE_SUPPRESSION_LINES, GENERIC_SECRET, MARKER, MARKER_SEVERITY,
    PLACEHOLDER, RISK_RULES, SECRET_RULES, SUPPRESSION, redact,
)

MAX_SCAN_BYTES = 1_000_000
MAX_FILES = 20_000
MAX_FINDINGS_PER_CATEGORY = 500
TIME_BUDGET_SECONDS = 15.0
MAX_LINE_CHARS = 4_000
SNIPPET_CHARS = 200
LARGE_FILE_BYTES = 512_000
# Functions at or above these cyclomatic complexities are reported as low and medium severity.
COMPLEXITY_LOW = 15
COMPLEXITY_MEDIUM = 25
MAX_LARGE_FILES = 20
SKIPPED_NAMES = frozenset({
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock", "poetry.lock", "Pipfile.lock",
    "composer.lock", "Gemfile.lock", "go.sum", "uv.lock", "bun.lockb",
})
SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2, "info": 3}
CATEGORIES = ("secret", "risk", "complexity", "marker")
_MARKER_LEAD = re.compile(r"^\s*(\([^)]*\))?\s*[:\-–]?\s*")
_COMMENT_CLOSE = re.compile(r"\s*(\*/|-->)\s*$")


def _snippet(line: str) -> str:
    text = line.strip()
    return text if len(text) <= SNIPPET_CHARS else text[:SNIPPET_CHARS] + "…"


class HealthService:
    def __init__(self, files: FileMetadataRepositoryPort, parser: CodeParserPort | None = None) -> None:
        self._files = files
        self._parser = parser

    def scan(self, repository_id: int) -> HealthReport:
        repository = self._files.get_repository(repository_id)
        if repository is None:
            raise RepositoryNotFoundError(f"No repository with id={repository_id}")
        root = Path(repository.root_path).resolve()
        indexed = self._files.list_files(repository_id)

        large = sorted(
            (LargeFile(file.relative_path, file.size_bytes) for file in indexed if file.size_bytes >= LARGE_FILE_BYTES),
            key=lambda item: -item.size_bytes,
        )[:MAX_LARGE_FILES]

        findings: dict[str, list[HealthFinding]] = {category: [] for category in CATEGORIES}
        scanned = 0
        truncated = False
        deadline = time.monotonic() + TIME_BUDGET_SECONDS
        for file in sorted(indexed, key=lambda item: item.relative_path):
            if file.is_binary or file.size_bytes > MAX_SCAN_BYTES:
                continue
            name = file.name
            if name in SKIPPED_NAMES or name.endswith((".min.js", ".min.css", ".map")):
                continue
            if scanned >= MAX_FILES or time.monotonic() > deadline:
                truncated = True
                break
            target = (root / file.relative_path).resolve()
            if not target.is_relative_to(root):
                continue
            try:
                raw = target.read_bytes()
            except OSError:
                continue
            text = raw.decode("utf-8", errors="replace")
            scanned += 1
            if FILE_SUPPRESSION.search("\n".join(text.splitlines()[:FILE_SUPPRESSION_LINES])):
                continue
            if self._scan_text(file.relative_path, file.language.value, text, findings):
                truncated = True
            if self._parser is not None and self._parser.supports(file.language):
                if self._scan_complexity(file.relative_path, file.language, raw, text, findings):
                    truncated = True

        ordered = [
            finding
            for category in CATEGORIES
            for finding in sorted(findings[category], key=lambda f: (SEVERITY_ORDER[f.severity], f.path, f.line))
        ]
        return HealthReport(
            files_scanned=scanned,
            findings=ordered,
            large_files=large,
            truncated=truncated,
            counts={category: len(items) for category, items in findings.items()},
        )

    def _scan_complexity(self, path: str, language: Language, raw: bytes, text: str,
                         findings: dict[str, list[HealthFinding]]) -> bool:
        """Report functions whose cyclomatic complexity reaches COMPLEXITY_LOW; True if the category is full."""
        assert self._parser is not None
        lines = text.splitlines()
        for function in self._parser.complexity(raw, language):
            if function.complexity < COMPLEXITY_LOW:
                continue
            line = lines[function.start_line - 1] if function.start_line <= len(lines) else ""
            if SUPPRESSION.search(line):
                continue
            if len(findings["complexity"]) >= MAX_FINDINGS_PER_CATEGORY:
                return True
            severity = "medium" if function.complexity >= COMPLEXITY_MEDIUM else "low"
            findings["complexity"].append(HealthFinding(
                "complexity", "cyclomatic-complexity", severity,
                f"{function.name} has a cyclomatic complexity of {function.complexity}",
                path, function.start_line, _snippet(line[:MAX_LINE_CHARS]),
            ))
        return False

    @staticmethod
    def _scan_text(path: str, language: str, text: str, findings: dict[str, list[HealthFinding]]) -> bool:
        """Append findings for one file; returns True if a category hit its cap."""
        capped = False

        def add(category: str, finding: HealthFinding) -> None:
            nonlocal capped
            if len(findings[category]) >= MAX_FINDINGS_PER_CATEGORY:
                capped = True
                return
            findings[category].append(finding)

        for number, raw in enumerate(text.splitlines(), start=1):
            line = raw[:MAX_LINE_CHARS]
            if SUPPRESSION.search(line):
                continue

            secret_hit = False
            for rule in SECRET_RULES:
                match = rule.pattern.search(line)
                if match:
                    secret_hit = True
                    add("secret", HealthFinding("secret", rule.rule, rule.severity, rule.title, path, number,
                                                _snippet(line.replace(match.group(0), redact(match.group(0))))))
                    break
            if not secret_hit:
                connection = CONNECTION_STRING.search(line)
                if connection and not PLACEHOLDER.match(connection.group(2)):
                    secret_hit = True
                    password = connection.group(2)
                    add("secret", HealthFinding("secret", "connection-string-password", "medium",
                                                "Password in a connection string", path, number,
                                                _snippet(line.replace(password, redact(password)))))
            if not secret_hit:
                generic = GENERIC_SECRET.search(line)
                if generic and not PLACEHOLDER.match(generic.group(3)):
                    value = generic.group(3)
                    add("secret", HealthFinding("secret", "hardcoded-credential", "medium",
                                                f"Hardcoded {generic.group(1).lower()}", path, number,
                                                _snippet(line.replace(value, redact(value)))))

            for rule in RISK_RULES:
                if rule.languages is not None and language not in rule.languages:
                    continue
                if rule.pattern.search(line):
                    add("risk", HealthFinding("risk", rule.rule, rule.severity, rule.title, path, number, _snippet(line)))

            marker = MARKER.search(line)
            if marker and COMMENT_TOKEN.search(line[:marker.start()]):
                tag = marker.group(1)
                # Drop an "(owner)" tag, a leading colon or dash, and a trailing comment closer.
                note = _MARKER_LEAD.sub("", line[marker.end():])
                note = _COMMENT_CLOSE.sub("", note).strip()
                note = note[:120] + "…" if len(note) > 120 else note
                add("marker", HealthFinding("marker", tag, MARKER_SEVERITY[tag], f"{tag}: {note}" if note else tag,
                                            path, number, _snippet(line)))
        return capped

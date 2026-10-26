"""Heuristic code-health rules: TODO markers, risky calls, and likely secrets.

Every rule is a regular expression applied line by line. They are signals for
a human to review, not proof of a problem. A line containing `ifrog-ignore`,
`gitleaks:allow`, or `nosec` is skipped by all rules, and `ifrog-ignore-file`
within a file's first ten lines skips the whole file (as this one does, since
it is made of the patterns it describes).

ifrog-ignore-file
"""
from __future__ import annotations

import re
from dataclasses import dataclass

SUPPRESSION = re.compile(r"ifrog-ignore|gitleaks:allow|\bnosec\b")
FILE_SUPPRESSION = re.compile(r"ifrog-ignore-file")
FILE_SUPPRESSION_LINES = 10
COMMENT_TOKEN = re.compile(r"(#|//|/\*|^\s*\*|<!--|--|;)")
MARKER = re.compile(r"(?<![A-Za-z0-9_])(TODO|FIXME|HACK|XXX|BUG)(?![A-Za-z0-9_])")
MARKER_SEVERITY = {"TODO": "info", "XXX": "low", "HACK": "low", "FIXME": "low", "BUG": "low"}

CODE_LANGUAGES = {"python", "javascript", "typescript", "jsx", "tsx"}


@dataclass(frozen=True, slots=True)
class PatternRule:
    rule: str
    title: str
    severity: str
    pattern: re.Pattern[str]
    languages: frozenset[str] | None = None
    """Restrict to these index languages; None applies to every text file."""


RISK_RULES: tuple[PatternRule, ...] = (
    PatternRule("eval", "eval() runs arbitrary code", "medium", re.compile(r"(?<![\w.])eval\s*\("), frozenset(CODE_LANGUAGES)),
    PatternRule("exec", "exec() runs arbitrary code", "medium", re.compile(r"(?<![\w.])exec\s*\("), frozenset({"python"})),
    PatternRule("shell-true", "subprocess call with shell=True", "medium", re.compile(r"subprocess\.\w+\(.*shell\s*=\s*True"), frozenset({"python"})),
    PatternRule("os-system", "os.system() passes a string to the shell", "low", re.compile(r"\bos\.system\s*\("), frozenset({"python"})),
    PatternRule("pickle", "Unpickling can execute code from untrusted data", "medium", re.compile(r"\bpickle\.loads?\s*\("), frozenset({"python"})),
    PatternRule("yaml-load", "yaml.load() without a safe Loader", "medium", re.compile(r"\byaml\.load\s*\((?![^)]*Loader)"), frozenset({"python"})),
    PatternRule("tls-verify-off", "TLS certificate verification disabled", "medium", re.compile(r"verify\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['\"]?0")),
    PatternRule("weak-hash", "MD5 or SHA-1 is too weak for security uses", "low", re.compile(r"\bhashlib\.(md5|sha1)\s*\(|createHash\(\s*['\"](md5|sha1)['\"]")),
    PatternRule("dangerous-html", "dangerouslySetInnerHTML can inject unsanitized HTML", "medium", re.compile(r"dangerouslySetInnerHTML"), frozenset({"javascript", "typescript", "jsx", "tsx"})),
    PatternRule("inner-html", "Assigning innerHTML can inject unsanitized HTML", "low", re.compile(r"\.innerHTML\s*=(?!=)"), frozenset({"javascript", "typescript", "jsx", "tsx", "html"})),
    PatternRule("new-function", "new Function() compiles code from strings", "medium", re.compile(r"\bnew\s+Function\s*\("), frozenset({"javascript", "typescript", "jsx", "tsx"})),
    PatternRule("curl-pipe-shell", "Piping a download straight into a shell", "medium", re.compile(r"\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b")),
)

SECRET_RULES: tuple[PatternRule, ...] = (
    PatternRule("private-key", "Private key", "high", re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----")),
    PatternRule("aws-access-key", "AWS access key ID", "high", re.compile(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b")),
    PatternRule("github-token", "GitHub token", "high", re.compile(r"\b(gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{22,255})\b")),
    PatternRule("slack-token", "Slack token", "high", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    PatternRule("google-api-key", "Google API key", "high", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    PatternRule("stripe-live-key", "Stripe live secret key", "high", re.compile(r"\b(sk|rk)_live_[0-9A-Za-z]{24,}\b")),
    PatternRule("anthropic-key", "Anthropic API key", "high", re.compile(r"\bsk-ant-[A-Za-z0-9_\-]{20,}")),
    PatternRule("openai-key", "OpenAI API key", "high", re.compile(r"\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_\-]{40,}")),
)

GENERIC_SECRET = re.compile(
    r"(?i)\b(api[_-]?key|secret[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|secret|token|passwd|password)\b"
    r"\s*[:=]\s*(['\"])([^'\"\s]{8,})\2"
)
PLACEHOLDER = re.compile(
    r"(?i)^(x+|\*+|\.+|<[^>]*>|\$\{[^}]*\}|\{\{[^}]*\}\}|\{[^}]*\}|%\(.*\)s|changeme|change[_-]?me|example\w*|sample\w*|"
    r"your[_-]?\w*|placeholder\w*|dummy\w*|test\w*|fake\w*|redacted|password\w*|secret\w*|none|null|undefined)$"
)


def redact(value: str) -> str:
    """Keep only enough of a secret to recognize it."""
    return f"{value[:4]}…[redacted]" if len(value) > 4 else "[redacted]"

"""Extension -> Language lookup.

This also doubles as the source of truth for which languages Milestone 2
(Tree-sitter parsing) needs grammars for, since only files we can classify
here are candidates for AST parsing.
"""
from app.domain.models import Language

EXTENSION_LANGUAGE_MAP: dict[str, Language] = {
    ".py": Language.PYTHON,
    ".pyi": Language.PYTHON,
    ".ts": Language.TYPESCRIPT,
    ".mts": Language.TYPESCRIPT,
    ".cts": Language.TYPESCRIPT,
    ".tsx": Language.TSX,
    ".js": Language.JAVASCRIPT,
    ".mjs": Language.JAVASCRIPT,
    ".cjs": Language.JAVASCRIPT,
    ".jsx": Language.JSX,
    ".rs": Language.RUST,
    ".go": Language.GO,
    ".java": Language.JAVA,
    ".c": Language.C,
    ".h": Language.C,
    ".cpp": Language.CPP,
    ".cc": Language.CPP,
    ".cxx": Language.CPP,
    ".hpp": Language.CPP,
    ".cs": Language.CSHARP,
    ".rb": Language.RUBY,
    ".php": Language.PHP,
    ".json": Language.JSON,
    ".yml": Language.YAML,
    ".yaml": Language.YAML,
    ".toml": Language.TOML,
    ".md": Language.MARKDOWN,
    ".markdown": Language.MARKDOWN,
    ".html": Language.HTML,
    ".htm": Language.HTML,
    ".css": Language.CSS,
    ".scss": Language.CSS,
    ".sh": Language.SHELL,
    ".bash": Language.SHELL,
    ".sql": Language.SQL,
}

# Extensions that are unambiguously binary; used as a fast-path so we don't
# waste time attempting to decode them as UTF-8 when hashing/sizing.
BINARY_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".gz",
        ".tar", ".woff", ".woff2", ".ttf", ".eot", ".so", ".dll", ".dylib",
        ".exe", ".bin", ".db", ".sqlite", ".sqlite3", ".pyc", ".class",
    }
)


def detect_language(relative_path: str) -> Language:
    for ext, language in EXTENSION_LANGUAGE_MAP.items():
        if relative_path.endswith(ext):
            return language
    return Language.OTHER


def is_binary_extension(relative_path: str) -> bool:
    return any(relative_path.endswith(ext) for ext in BINARY_EXTENSIONS)

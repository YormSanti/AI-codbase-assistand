"""Extension -> Language lookup.

This also doubles as the source of truth for which languages Milestone 2
(Tree-sitter parsing) needs grammars for, since only files we can classify
here are candidates for AST parsing.
"""
from pathlib import PurePosixPath

from app.domain.models import Language

EXTENSION_LANGUAGE_MAP: dict[str, Language] = {
    ".py": Language.PYTHON,
    ".pyi": Language.PYTHON,
    ".pyw": Language.PYTHON,
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
    ".c++": Language.CPP,
    ".hpp": Language.CPP,
    ".hh": Language.CPP,
    ".hxx": Language.CPP,
    ".cs": Language.CSHARP,
    ".rb": Language.RUBY,
    ".rake": Language.RUBY,
    ".gemspec": Language.RUBY,
    ".php": Language.PHP,
    ".json": Language.JSON,
    ".jsonc": Language.JSON,
    ".yml": Language.YAML,
    ".yaml": Language.YAML,
    ".toml": Language.TOML,
    ".md": Language.MARKDOWN,
    ".markdown": Language.MARKDOWN,
    ".mdx": Language.MARKDOWN,
    ".html": Language.HTML,
    ".htm": Language.HTML,
    ".xhtml": Language.HTML,
    ".css": Language.CSS,
    ".scss": Language.CSS,
    ".sass": Language.CSS,
    ".less": Language.CSS,
    ".sh": Language.SHELL,
    ".bash": Language.SHELL,
    ".zsh": Language.SHELL,
    ".ksh": Language.SHELL,
    ".sql": Language.SQL,
}

# Files recognized by their whole name, usually because they have no extension.
FILENAME_LANGUAGE_MAP: dict[str, Language] = {
    ".bashrc": Language.SHELL,
    ".bash_profile": Language.SHELL,
    ".zshrc": Language.SHELL,
    ".profile": Language.SHELL,
    "rakefile": Language.RUBY,
    "gemfile": Language.RUBY,
}

# Extensions that are unambiguously binary; used as a fast-path so we don't
# waste time attempting to decode them as UTF-8 when hashing/sizing.
BINARY_EXTENSIONS: frozenset[str] = frozenset(
    {
        # images
        ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".bmp", ".tif", ".tiff", ".avif", ".heic",
        ".icns", ".psd",
        # audio and video
        ".mp3", ".wav", ".ogg", ".flac", ".m4a", ".mp4", ".mov", ".avi", ".mkv", ".webm",
        # documents
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        # archives and packages
        ".zip", ".gz", ".tgz", ".tar", ".bz2", ".xz", ".zst", ".7z", ".rar", ".jar", ".war", ".whl",
        ".dmg", ".iso", ".msi", ".deb", ".rpm", ".apk",
        # fonts
        ".woff", ".woff2", ".ttf", ".otf", ".eot",
        # compiled code and native libraries
        ".so", ".dll", ".dylib", ".exe", ".bin", ".o", ".a", ".lib", ".obj", ".pdb", ".wasm",
        ".pyc", ".pyd", ".class",
        # data stores and model weights
        ".db", ".sqlite", ".sqlite3", ".lockb", ".parquet", ".pkl", ".npy", ".npz", ".onnx", ".pt",
    }
)


def _suffix(relative_path: str) -> str:
    return PurePosixPath(relative_path).suffix.lower()


def detect_language(relative_path: str) -> Language:
    """Language by file extension, ignoring case (`App.PY`, `README.MD`), or by a known file name."""
    language = EXTENSION_LANGUAGE_MAP.get(_suffix(relative_path))
    if language is None:
        language = FILENAME_LANGUAGE_MAP.get(PurePosixPath(relative_path).name.lower(), Language.OTHER)
    return language


def is_binary_extension(relative_path: str) -> bool:
    return _suffix(relative_path) in BINARY_EXTENSIONS

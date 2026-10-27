from app.domain.models import Language
from app.infrastructure.parsing.language_map import detect_language, is_binary_extension


def test_detect_language_ignores_case_and_uses_the_last_extension() -> None:
    assert detect_language("src/App.PY") is Language.PYTHON
    assert detect_language("README.MD") is Language.MARKDOWN
    assert detect_language("types/index.d.ts") is Language.TYPESCRIPT
    assert detect_language("ui/Button.tsx") is Language.TSX
    assert detect_language("lib/module.mts") is Language.TYPESCRIPT
    assert detect_language("include/vector.hpp") is Language.CPP
    assert detect_language("include/stdio.h") is Language.C


def test_detect_language_covers_more_extensions_and_known_file_names() -> None:
    assert detect_language("tsconfig.jsonc") is Language.JSON
    assert detect_language("styles/theme.less") is Language.CSS
    assert detect_language("docs/intro.mdx") is Language.MARKDOWN
    assert detect_language("scripts/setup.zsh") is Language.SHELL
    assert detect_language("home/.bashrc") is Language.SHELL
    assert detect_language("Gemfile") is Language.RUBY
    assert detect_language("Makefile") is Language.OTHER
    assert detect_language("notes") is Language.OTHER
    assert detect_language("archive.ts.bak") is Language.OTHER


def test_is_binary_extension_ignores_case_and_covers_media_and_archives() -> None:
    for path in ("Logo.PNG", "hero.webp", "intro.mp4", "app.wasm", "lib/vendor.jar", "model.onnx", "bun.lockb"):
        assert is_binary_extension(path), path
    for path in ("main.py", "png.txt", "Dockerfile", "data.json"):
        assert not is_binary_extension(path), path

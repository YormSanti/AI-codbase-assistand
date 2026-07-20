from app.domain.models import Language, SymbolKind
from app.infrastructure.parsing.treesitter_parser import TreeSitterCodeParser


def test_supports_declares_python_js_ts_only() -> None:
    parser = TreeSitterCodeParser()

    assert parser.supports(Language.PYTHON) is True
    assert parser.supports(Language.TYPESCRIPT) is True
    assert parser.supports(Language.TSX) is True
    assert parser.supports(Language.JAVASCRIPT) is True
    assert parser.supports(Language.JSX) is True
    assert parser.supports(Language.RUST) is False
    assert parser.supports(Language.MARKDOWN) is False


def test_parse_python_extracts_classes_methods_functions_imports() -> None:
    parser = TreeSitterCodeParser()
    source = b"""
import os
from foo import bar

class Greeter:
    def greet(self, name):
        return name

def top_level():
    pass
"""
    symbols = parser.parse(source, Language.PYTHON)

    names_and_kinds = {(s.name, s.kind) for s in symbols}

    assert ("os", SymbolKind.IMPORT) not in names_and_kinds  # import name is the full statement
    assert any(s.kind == SymbolKind.IMPORT and "import os" in s.name for s in symbols)
    assert any(s.kind == SymbolKind.IMPORT and "from foo import bar" in s.name for s in symbols)
    assert ("Greeter", SymbolKind.CLASS) in names_and_kinds
    assert ("top_level", SymbolKind.FUNCTION) in names_and_kinds

    greet = next(s for s in symbols if s.name == "greet")
    assert greet.kind == SymbolKind.METHOD
    assert greet.parent_name == "Greeter"


def test_parse_python_nested_function_inside_method_is_not_a_method() -> None:
    parser = TreeSitterCodeParser()
    source = b"""
class Outer:
    def method(self):
        def inner():
            pass
        return inner
"""
    symbols = parser.parse(source, Language.PYTHON)

    inner = next(s for s in symbols if s.name == "inner")
    assert inner.kind == SymbolKind.FUNCTION
    assert inner.parent_name is None


def test_parse_typescript_extracts_class_methods_and_functions() -> None:
    parser = TreeSitterCodeParser()
    source = b"""
import { Foo } from "./foo";

export class Greeter {
  greet(name: string): string {
    return name;
  }
}

export function topLevel() {}
"""
    symbols = parser.parse(source, Language.TYPESCRIPT)
    names_and_kinds = {(s.name, s.kind) for s in symbols}

    assert ("Greeter", SymbolKind.CLASS) in names_and_kinds
    assert ("topLevel", SymbolKind.FUNCTION) in names_and_kinds
    greet = next(s for s in symbols if s.name == "greet")
    assert greet.kind == SymbolKind.METHOD
    assert greet.parent_name == "Greeter"
    assert any(s.kind == SymbolKind.IMPORT for s in symbols)


def test_parse_reports_1_indexed_line_numbers() -> None:
    parser = TreeSitterCodeParser()
    source = b"def f():\n    pass\n"

    [symbol] = parser.parse(source, Language.PYTHON)

    assert symbol.start_line == 1
    assert symbol.end_line == 2

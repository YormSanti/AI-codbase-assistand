"""Tree-sitter-backed implementation of `CodeParserPort`.

Extracts classes, functions/methods, and import statements from source
code, and scores each function's cyclomatic complexity. Deliberately conservative for this milestone: only named
declarations are captured (no anonymous/arrow functions, no re-exports),
which keeps the extraction rules simple and predictable across languages.
"""
from __future__ import annotations

from dataclasses import dataclass

import tree_sitter_javascript as tsjavascript
import tree_sitter_python as tspython
import tree_sitter_typescript as tstypescript
from tree_sitter import Language as TSLanguage
from tree_sitter import Node, Parser

from app.domain.models import CodeSymbol, FunctionComplexity, Language, SymbolKind
from app.domain.ports import CodeParserPort

_MAX_IMPORT_SNIPPET_LENGTH = 300


@dataclass(frozen=True)
class _GrammarConfig:
    ts_language: TSLanguage
    class_types: frozenset[str]
    class_name_types: frozenset[str]
    function_types: frozenset[str]
    function_name_types: frozenset[str]
    import_types: frozenset[str]
    variable_function_types: frozenset[str] = frozenset()


def _python_config() -> _GrammarConfig:
    return _GrammarConfig(
        ts_language=TSLanguage(tspython.language()),
        class_types=frozenset({"class_definition"}),
        class_name_types=frozenset({"identifier"}),
        function_types=frozenset({"function_definition"}),
        function_name_types=frozenset({"identifier"}),
        import_types=frozenset({"import_statement", "import_from_statement"}),
    )


def _javascript_config() -> _GrammarConfig:
    return _GrammarConfig(
        ts_language=TSLanguage(tsjavascript.language()),
        class_types=frozenset({"class_declaration"}),
        class_name_types=frozenset({"identifier", "type_identifier"}),
        function_types=frozenset({"function_declaration", "method_definition"}),
        function_name_types=frozenset({"identifier", "property_identifier"}),
        import_types=frozenset({"import_statement"}),
        variable_function_types=frozenset({"variable_declarator", "field_definition", "pair"}),
    )


def _typescript_config() -> _GrammarConfig:
    return _GrammarConfig(
        ts_language=TSLanguage(tstypescript.language_typescript()),
        class_types=frozenset({"class_declaration"}),
        class_name_types=frozenset({"identifier", "type_identifier"}),
        function_types=frozenset({"function_declaration", "method_definition"}),
        function_name_types=frozenset({"identifier", "property_identifier"}),
        import_types=frozenset({"import_statement"}),
        variable_function_types=frozenset({"variable_declarator", "public_field_definition", "pair"}),
    )


def _tsx_config() -> _GrammarConfig:
    return _GrammarConfig(
        ts_language=TSLanguage(tstypescript.language_tsx()),
        class_types=frozenset({"class_declaration"}),
        class_name_types=frozenset({"identifier", "type_identifier"}),
        function_types=frozenset({"function_declaration", "method_definition"}),
        function_name_types=frozenset({"identifier", "property_identifier"}),
        import_types=frozenset({"import_statement"}),
        variable_function_types=frozenset({"variable_declarator", "public_field_definition", "pair"}),
    )


def _find_name(node: Node, name_types: frozenset[str], source: bytes) -> str:
    for child in node.children:
        if child.type in name_types:
            return source[child.start_byte : child.end_byte].decode("utf-8", errors="replace")
    return "<anonymous>"


def _walk(
    node: Node,
    source: bytes,
    config: _GrammarConfig,
    current_class: str | None,
    symbols: list[CodeSymbol],
) -> None:
    if node.type in config.class_types:
        name = _find_name(node, config.class_name_types, source)
        symbols.append(
            CodeSymbol(
                name=name,
                kind=SymbolKind.CLASS,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
            )
        )
        for child in node.children:
            _walk(child, source, config, name, symbols)
        return

    if node.type in config.function_types:
        name = _find_name(node, config.function_name_types, source)
        kind = SymbolKind.METHOD if current_class else SymbolKind.FUNCTION
        symbols.append(
            CodeSymbol(
                name=name,
                kind=kind,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
                parent_name=current_class if kind is SymbolKind.METHOD else None,
            )
        )
        # A function body's own nested defs are locals, not methods of the
        # enclosing class, so scope resets going deeper.
        for child in node.children:
            _walk(child, source, config, None, symbols)
        return

    if node.type in config.import_types:
        raw = source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")
        snippet = " ".join(raw.split())[:_MAX_IMPORT_SNIPPET_LENGTH]
        symbols.append(
            CodeSymbol(
                name=snippet,
                kind=SymbolKind.IMPORT,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
            )
        )
        return

    if node.type in config.variable_function_types:
        if any(child.type in ("arrow_function", "function", "function_expression") for child in node.children):
            name = _find_name(node, config.function_name_types, source)
            # It's a method if it's a field in a class, or a pair in a class-like object, and we have a current_class.
            is_method = bool(current_class) and node.type in ("field_definition", "public_field_definition", "pair")
            kind = SymbolKind.METHOD if is_method else SymbolKind.FUNCTION
            symbols.append(
                CodeSymbol(
                    name=name,
                    kind=kind,
                    start_line=node.start_point[0] + 1,
                    end_line=node.end_point[0] + 1,
                    parent_name=current_class if is_method else None,
                )
            )
            for child in node.children:
                _walk(child, source, config, None, symbols)
            return

    for child in node.children:
        _walk(child, source, config, current_class, symbols)


# Nodes that start their own complexity count. Python lambdas stay with the enclosing function.
_FUNCTION_SCOPES = frozenset({
    "function_definition", "function_declaration", "generator_function_declaration", "method_definition",
    "arrow_function", "function_expression", "generator_function",
})
# Each of these adds one path through a function (Python, then JavaScript/TypeScript).
_BRANCH_NODES = frozenset({
    "if_statement", "elif_clause", "for_statement", "while_statement", "except_clause", "conditional_expression",
    "boolean_operator", "for_in_clause", "if_clause", "case_clause",
    "for_in_statement", "do_statement", "catch_clause", "ternary_expression", "switch_case",
})
_LOGICAL_OPERATORS = frozenset({"&&", "||", "??"})
# Where an unnamed function expression takes its name from: `const name = () => {}`, `{ name: () => {} }`, ...
_NAME_FIELDS = {
    "variable_declarator": "name", "pair": "key", "public_field_definition": "name",
    "field_definition": "property", "assignment_expression": "left",
}


def _text(node: Node, source: bytes) -> str:
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")


def _branch_points(node: Node, source: bytes) -> int:
    if node.type == "binary_expression":
        operator = node.child_by_field_name("operator")
        return 1 if operator is not None and operator.type in _LOGICAL_OPERATORS else 0
    if node.type == "case_clause":  # Python `case _:` is the default branch, like JavaScript's `default:`
        patterns = [child for child in node.children if child.type == "case_pattern"]
        return 0 if len(patterns) == 1 and _text(patterns[0], source).strip() == "_" else 1
    return 1 if node.type in _BRANCH_NODES else 0


def _function_name(node: Node, source: bytes) -> str:
    name = node.child_by_field_name("name")
    if name is None and node.parent is not None and node.parent.type in _NAME_FIELDS:
        name = node.parent.child_by_field_name(_NAME_FIELDS[node.parent.type])
    return " ".join(_text(name, source).split())[:120] if name is not None else "anonymous function"


def _complexity(root: Node, source: bytes) -> list[FunctionComplexity]:
    """McCabe complexity per function: 1 plus its branch points, with nested functions scored on their own."""
    found: list[list] = []  # [name, (row, column), score], indexed by the enclosing function
    stack: list[tuple[Node, int | None]] = [(root, None)]
    while stack:  # iterative, so deeply nested code cannot hit the recursion limit
        node, owner = stack.pop()
        if node.is_named and node.type in _FUNCTION_SCOPES:
            found.append([_function_name(node, source), tuple(node.start_point), 1])
            owner = len(found) - 1
        elif owner is not None:
            found[owner][2] += _branch_points(node, source)
        stack.extend((child, owner) for child in node.children)
    return [FunctionComplexity(name, start[0] + 1, score) for name, start, score in sorted(found, key=lambda item: item[1])]


class TreeSitterCodeParser(CodeParserPort):
    def __init__(self) -> None:
        javascript_config = _javascript_config()
        self._configs: dict[Language, _GrammarConfig] = {
            Language.PYTHON: _python_config(),
            Language.JAVASCRIPT: javascript_config,
            Language.JSX: javascript_config,
            Language.TYPESCRIPT: _typescript_config(),
            Language.TSX: _tsx_config(),
        }
        self._parsers: dict[Language, Parser] = {
            language: Parser(config.ts_language) for language, config in self._configs.items()
        }

    def supports(self, language: Language) -> bool:
        return language in self._configs

    def parse(self, source: bytes, language: Language) -> list[CodeSymbol]:
        config = self._configs[language]
        parser = self._parsers[language]
        tree = parser.parse(source)

        symbols: list[CodeSymbol] = []
        _walk(tree.root_node, source, config, current_class=None, symbols=symbols)
        return symbols

    def complexity(self, source: bytes, language: Language) -> list[FunctionComplexity]:
        return _complexity(self._parsers[language].parse(source).root_node, source)

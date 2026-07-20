"""Tree-sitter-backed implementation of `CodeParserPort`.

Extracts classes, functions/methods, and import statements from source
code. Deliberately conservative for this milestone: only named
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

from app.domain.models import CodeSymbol, Language, SymbolKind
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
    )


def _typescript_config() -> _GrammarConfig:
    return _GrammarConfig(
        ts_language=TSLanguage(tstypescript.language_typescript()),
        class_types=frozenset({"class_declaration"}),
        class_name_types=frozenset({"identifier", "type_identifier"}),
        function_types=frozenset({"function_declaration", "method_definition"}),
        function_name_types=frozenset({"identifier", "property_identifier"}),
        import_types=frozenset({"import_statement"}),
    )


def _tsx_config() -> _GrammarConfig:
    return _GrammarConfig(
        ts_language=TSLanguage(tstypescript.language_tsx()),
        class_types=frozenset({"class_declaration"}),
        class_name_types=frozenset({"identifier", "type_identifier"}),
        function_types=frozenset({"function_declaration", "method_definition"}),
        function_name_types=frozenset({"identifier", "property_identifier"}),
        import_types=frozenset({"import_statement"}),
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

    for child in node.children:
        _walk(child, source, config, current_class, symbols)


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

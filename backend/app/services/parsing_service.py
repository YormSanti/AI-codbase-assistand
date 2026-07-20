"""Application service orchestrating symbol extraction for a single file.

Kept separate from `IndexingService` (single responsibility): this service
only knows how to turn one `FileMetadata` + its content into stored
`CodeSymbol`s, via the `CodeParserPort` / `SymbolRepositoryPort`
abstractions. `IndexingService` calls it once per indexed file.
"""
from __future__ import annotations

from pathlib import Path

from app.domain.models import CodeSymbol, FileMetadata
from app.domain.ports import CodeParserPort, SymbolRepositoryPort


class SymbolExtractionService:
    def __init__(self, parser: CodeParserPort, symbol_repository: SymbolRepositoryPort) -> None:
        self._parser = parser
        self._symbol_repository = symbol_repository

    def extract_and_store(self, file: FileMetadata, root_path: str) -> list[CodeSymbol]:
        """Parse `file` and persist its symbols. No-ops for unsupported/binary files."""
        if file.is_binary or not self._parser.supports(file.language) or file.id is None:
            return []

        absolute_path = Path(root_path) / file.relative_path
        try:
            source = absolute_path.read_bytes()
        except OSError:
            return []

        symbols = self._parser.parse(source, file.language)
        return self._symbol_repository.replace_symbols(file.id, symbols)

    def list_for_file(self, file_id: int) -> list[CodeSymbol]:
        return self._symbol_repository.list_symbols_for_file(file_id)

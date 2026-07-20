# Architecture

DevPilot AI's backend follows a clean/hexagonal architecture: dependencies
point inward, from infrastructure toward the domain, never the reverse.

```
app/
  domain/            Pure business logic. No FastAPI, SQLAlchemy, or
                      GitPython imports allowed here.
    models.py           Dataclasses: FileMetadata, RepositoryInfo, TreeNode,
                         CodeSymbol, SymbolKind
    ports.py            Abstract interfaces (GitClientPort,
                         FileMetadataRepositoryPort, CodeParserPort,
                         SymbolRepositoryPort) the services depend on
    tree_builder.py      Pure function: flat files -> nested TreeNode
    exceptions.py        Domain errors (NotAGitRepositoryError, ...)

  services/           Application/use-case layer. Orchestrates ports.
    indexing_service.py  IndexingService — open/index a repo, build its
                          tree, look up a file's symbols
    parsing_service.py   SymbolExtractionService — parse one file, persist
                          its symbols

  infrastructure/     Concrete adapters implementing the ports above.
    git/git_client.py             GitPythonClient(GitClientPort)
    parsing/file_scanner.py       scan_files(): size/hash/language per file
    parsing/treesitter_parser.py  TreeSitterCodeParser(CodeParserPort)
    db/orm_models.py              SQLAlchemy tables
    db/sqlite_repository.py       SqlAlchemyFileMetadataRepository(...)
    db/sqlite_symbol_repository.py SqlAlchemySymbolRepository(...)

  api/                 HTTP boundary. Translates domain <-> JSON, wires
                        concrete adapters into services via FastAPI Depends.
    schemas.py            Pydantic request/response models
    deps.py                Composition root (constructs adapters, injects them)
    routes/repository.py   Repository/tree endpoints
    routes/files.py        GET /api/files/{file_id}/symbols
```

## Why this shape

- **Testability.** `IndexingService` and `SymbolExtractionService` are
  tested against a real (in-memory) SQLite database with no FastAPI or HTTP
  involved (`tests/test_indexing_service.py`, `tests/test_parsing_service.py`).
  The API layer is tested separately with `TestClient`.
- **Repository pattern.** `FileMetadataRepositoryPort` / `SymbolRepositoryPort`
  are the only interfaces services use for persistence; the two
  `SqlAlchemy*Repository` classes are the only files that import SQLAlchemy's
  ORM models. Swapping storage engines later (e.g. Postgres for a hosted
  mode) touches those two files.
- **Dependency injection.** `app/api/deps.py` is the single composition
  root: it constructs `GitPythonClient`, the two SQLAlchemy repositories,
  `scan_files`, and a shared `TreeSitterCodeParser`, then wires them into
  `IndexingService`/`SymbolExtractionService` via their declared port types.
  Tests substitute a different session/engine at the same seam.
- **One parser instance, not one per request.** `TreeSitterCodeParser`
  loads its grammars once at construction; `deps.py` builds a single
  module-level instance reused across requests rather than reconstructing
  it per call. Fine for a single-user desktop tool — would need
  per-request/thread instances if this ever serves concurrent requests from
  multiple clients, since `tree_sitter.Parser.parse` isn't guaranteed safe
  to call concurrently on the same instance from multiple threads.

## Symbol extraction (Tree-sitter)

`TreeSitterCodeParser` walks each file's AST and extracts:

- **Classes** (`class_definition` / `class_declaration`)
- **Functions and methods** — a function nested directly inside a class is
  a `METHOD` with `parent_name` set to the class; a function nested inside
  *another function* (including a method) is a plain `FUNCTION`, since it's
  a local helper, not part of the class's interface
- **Imports** — stored as a single collapsed-whitespace snippet of the
  whole statement (`"from foo import bar"`), not split into individual
  imported names

Grammars: Python, JavaScript (also covers `.jsx` — the `tree-sitter-javascript`
grammar parses JSX natively), TypeScript, and TSX. Only named declarations
are captured for this milestone — arrow functions and
`const foo = () => {}` are not yet extracted (see docs/MILESTONES.md).

`IndexingService.open_repository` calls `SymbolExtractionService` once per
indexed, non-binary file whose language has a registered grammar; symbols
for unsupported languages/binary files are simply skipped, not errors.

## Frontend

The frontend is a standard Vite + React + TypeScript app (no framework-level
"clean architecture" needed at this size), split into:

```
frontend/src/
  types/domain.ts        TS types mirroring the backend's Pydantic schemas
  api/client.ts           fetch wrapper + ApiError
  api/repositoryApi.ts     Typed calls: open / list / getTree
  components/              RepositoryPicker, RepositoryTree
  App.tsx                  Wires state + components together
```

It currently runs as a plain web app (`npm run dev`) rather than inside
Tauri, because this environment has no Rust toolchain. The React code does
not need to change to run inside Tauri later — only a thin `src-tauri/`
wrapper needs to be added around it (see docs/MILESTONES.md).

Theming uses CSS custom properties (`--color-*`) defined once in
`index.css` with a `prefers-color-scheme: dark` override, consumed by
`App.css` — not hardcoded colors per component. That was a real bug fixed
during development: hardcoded light-mode text color in `App.css` was
loaded after (and so won, at equal specificity, over) the dark-mode
override in `index.css`, making text nearly invisible in dark mode.
Variables sidestep load-order entirely.

## Data model (SQLite)

```
repositories(id, name, root_path UNIQUE, current_branch, head_commit, opened_at)

files(id, repository_id FK -> repositories.id ON DELETE CASCADE,
      relative_path, size_bytes, language, content_hash, is_binary)
  UNIQUE(repository_id, relative_path)

symbols(id, file_id FK -> files.id ON DELETE CASCADE,
        kind, name, parent_name, start_line, end_line)
```

`PRAGMA foreign_keys=ON` is enabled explicitly on every SQLite connection
(`database.py`, registered on the generic `Engine` class so it also covers
engines tests create) — SQLite ignores foreign keys, including
`ON DELETE CASCADE`, by default. Without it, re-indexing a repository
(which bulk-deletes and re-inserts `FileRecord`s) would silently leave
orphaned `symbols` rows behind, and since SQLite can reuse rowids, a new
unrelated file could inherit a stale file's leftover symbols. Verified with
a direct cascade test during Milestone 1.2.

Opening an already-known `root_path` re-indexes in place (files and their
symbols are fully replaced, not appended), so re-opening a repo after a
`git pull` reflects the new state.

# Architecture

DevPilot AI's backend follows a clean/hexagonal architecture: dependencies
point inward, from infrastructure toward the domain, never the reverse.

```
app/
  domain/            Pure business logic. No FastAPI, SQLAlchemy, or
                      GitPython imports allowed here.
    models.py           Dataclasses: FileMetadata, RepositoryInfo, TreeNode
    ports.py            Abstract interfaces (GitClientPort,
                         FileMetadataRepositoryPort) the services depend on
    tree_builder.py      Pure function: flat files -> nested TreeNode
    exceptions.py        Domain errors (NotAGitRepositoryError, ...)

  services/           Application/use-case layer. Orchestrates ports.
    indexing_service.py  IndexingService — open/index a repo, build its tree

  infrastructure/     Concrete adapters implementing the ports above.
    git/git_client.py         GitPythonClient(GitClientPort)
    parsing/file_scanner.py   scan_files(): size/hash/language per file
    db/orm_models.py          SQLAlchemy tables
    db/sqlite_repository.py   SqlAlchemyFileMetadataRepository(...Port)

  api/                 HTTP boundary. Translates domain <-> JSON, wires
                        concrete adapters into services via FastAPI Depends.
    schemas.py           Pydantic request/response models
    deps.py               Composition root (constructs adapters, injects them)
    routes/repository.py  Endpoints; catches domain exceptions -> HTTP codes
```

## Why this shape

- **Testability.** `IndexingService` is tested against fakes/a real SQLite
  file with no FastAPI or HTTP involved (`tests/test_indexing_service.py`).
  The API layer is tested separately with `TestClient`
  (`tests/test_api_repository.py`).
- **Repository pattern.** `FileMetadataRepositoryPort` is the only interface
  services use for persistence; `SqlAlchemyFileMetadataRepository` is the
  only file that imports SQLAlchemy's ORM models. Swapping storage engines
  later (e.g. Postgres for a hosted mode) touches one file.
- **Dependency injection.** `app/api/deps.py` is the single composition
  root: it constructs `GitPythonClient`, `SqlAlchemyFileMetadataRepository`,
  and `scan_files`, and hands them to `IndexingService` as its declared port
  types. Tests substitute a different session/engine at the same seam.

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

## Data model (SQLite)

```
repositories(id, name, root_path UNIQUE, current_branch, head_commit, opened_at)
files(id, repository_id FK, relative_path, size_bytes, language, content_hash, is_binary)
  UNIQUE(repository_id, relative_path)
```

Opening an already-known `root_path` re-indexes in place (files are fully
replaced, not appended), so re-opening a repo after a `git pull` reflects
the new state.

Milestone 2 will add `classes`, `functions`, and `imports` tables that
reference `files.id`, populated by Tree-sitter.

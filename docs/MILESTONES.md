# Milestones

Tracks progress against the four-phase roadmap. Each milestone is meant to
be independently functional and tested before the next one starts.

## Phase 1 — Repository indexing

- [x] **Milestone 1.1 — Project scaffold + Git indexing** (done)
  - Clean-architecture backend skeleton (domain / services / infrastructure / api)
  - Open a local Git repository (GitPython), respecting `.gitignore`
  - Persist file metadata (path, size, language, hash) to SQLite
  - `POST /api/repositories/open`, `GET /api/repositories`,
    `GET /api/repositories/{id}`, `GET /api/repositories/{id}/tree`
  - Frontend: Vite + React + TS app that opens a repo and renders the tree
  - 22 backend tests (pytest), 8 frontend tests (vitest) — all passing
- [x] **Milestone 1.2 — Tree-sitter parsing** (done)
  - `TreeSitterCodeParser` extracts classes, functions/methods, and import
    statements for Python, JavaScript, JSX, TypeScript, and TSX
  - Methods vs. top-level functions are distinguished by ancestry; a
    function nested inside a method is correctly treated as a local
    function, not a second method
  - Single `symbols` table (kind: class/function/method/import), FK to
    `files.id` with `ON DELETE CASCADE` (SQLite `PRAGMA foreign_keys=ON`
    enabled explicitly — verified re-indexing doesn't orphan old symbol rows)
  - Parsing runs automatically as part of `open_repository`, per indexed
    non-binary file whose language has a grammar
  - API: `GET /api/files/{file_id}/symbols`; `TreeNode`/tree API now expose
    `file_id` on leaf nodes so the frontend can address a specific file
  - Known limitation: only named declarations are captured — arrow
    functions and `const foo = () => {}` are not extracted yet
  - 14 new backend tests (parser, extraction service, indexing integration,
    API) — 36 backend tests total, all passing
- [ ] **Milestone 1.3 — Tree UI polish**
  - Show per-file symbol counts / icons in the tree
  - Loading and empty states, basic file preview pane

## Phase 2 — Semantic search & RAG chat

- [ ] Embed indexed files/functions into ChromaDB
- [ ] Retrieval endpoint: given a query, return top-k relevant chunks
- [ ] Ollama-backed chat endpoint that grounds answers in retrieved chunks
  (not the whole repo)
- [ ] Chat UI

*Ollama is not installed in the current dev environment — flagged for
setup when this phase starts.*

## Phase 3 — Architecture & Git intelligence

- [ ] Module dependency graph (Graphviz) from Tree-sitter import data
- [ ] Call graph
- [ ] Folder structure visualization (React Flow)
- [ ] Git history, branch status, commit summaries

## Phase 4 — Health & security

- [ ] Duplicate code, large files, TODOs, cyclomatic complexity
- [ ] Hardcoded secrets, weak crypto, risky pattern scanning

## Environment notes

- Tauri requires a Rust toolchain, not present in this environment. The
  frontend runs as a plain web app for now; wrapping it in Tauri later is a
  small, additive change (see docs/ARCHITECTURE.md).
- Python 3.14 is in use; all Phase 1 dependencies (FastAPI, SQLAlchemy,
  GitPython, Pydantic v2) installed and tested cleanly against it.

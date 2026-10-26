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
- [x] **Milestone 1.3 — Incremental indexing** (done, 2026-10-26)
  - Reopening a known repository hashes files but only re-parses the ones
    whose content changed; unchanged files keep their ids and symbols
  - `POST /api/repositories/{id}/reindex` forces a full re-parse (Dashboard
    **Re-index** button, command palette)
- [ ] **Milestone 1.4 — Tree UI polish**
  - Show per-file symbol counts / icons in the tree

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
- [x] Live Git history and branch status, staged/unstaged file diffs,
  untracked previews, conflicts, local upstream ahead/behind counts, and
  selected-repository remote links
- [x] Selected-diff handoff to desktop AI for review and commit-message suggestions
- [x] Stage, unstage, mark-resolved, and commit from the editor's Source
  Control view (`POST .../git/stage`, `.../git/unstage`, `.../git/commit`)
- [x] AI-written commit messages from the staged diff and AI review of a
  file diff or of everything staged (`GET .../git/staged-diff`)
- [x] Live Git data on the Dashboard and Git Repository page (branch,
  upstream ahead/behind, working tree summary, recent commits), honoring the
  Git refresh interval setting

## Phase 4 — Health & security

- [ ] Duplicate code, large files, TODOs, cyclomatic complexity
- [ ] Hardcoded secrets, weak crypto, risky pattern scanning

## Shell and performance (2026-10-26)

- [x] Dead shadcn leftovers and ten unused npm packages removed; toaster
  mounted so toasts actually show
- [x] On-demand pages (terminal, analytics, Git, AI, settings) and editor tool
  views load as separate chunks; main JS chunk 1.3 MB -> ~0.5 MB
- [x] Local font stacks instead of a Google Fonts request
- [x] Desktop build waits for the sidecar `/health` before the first request
- [x] Light theme readable everywhere (theme tokens + overlay variables)
- [x] Command palette (Ctrl/Cmd+K, Ctrl/Cmd+Shift+P) for pages, projects,
  re-index, and theme
- [x] Dismissible global error; hidden terminal pages and AI threads capped
  to the most recently used
- [x] Backend ships as a PyInstaller `--onedir` bundle under the app's
  resource directory (no per-launch extraction of a 31 MB executable);
  the Tauri shell plugin is no longer needed
- [x] Reopening a project costs one `stat` per unchanged file (size + mtime
  shortcut); `migrate_schema` upgrades existing SQLite files
- [x] Project-wide **Search in files** (Ctrl/Cmd+Shift+F) with jump-to-line
- [ ] Replace native `window.confirm` prompts with in-app dialogs

## Environment notes

- [x] A Tauri 2 desktop shell now bundles the React UI and FastAPI backend
  sidecar, uses a native repository folder picker, and stores its database in
  the OS application-data directory.
- Building Tauri on Linux requires the WebKitGTK 4.1 development packages.
  They must be installed by an administrator before producing an installer.
- Python 3.14 is in use; all Phase 1 dependencies (FastAPI, SQLAlchemy,
  GitPython, Pydantic v2) installed and tested cleanly against it.

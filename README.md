# DevPilot AI

An AI-powered Developer Intelligence Platform: repository indexing, code
parsing, semantic search, RAG-based chat, architecture visualization, Git
intelligence, and project health/security analysis.

Built incrementally — see [`docs/MILESTONES.md`](docs/MILESTONES.md) for
what's done and what's next, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the clean-architecture layout.

## Status

Phase 1, Milestones 1.1 and 1.2 complete: open a Git repository, index its
files (path/size/language/hash respecting `.gitignore`), parse Python/JS/TS
source with Tree-sitter to extract classes/functions/methods/imports, and
browse the tree from a web UI.

The Git Repository page uses the original repository dashboard. Its activity
list and branch diagram are illustrative, not live Git history. Read-only
Git status and diff APIs remain available in the backend.

## Prerequisites

- Python 3.11+ (tested on 3.14)
- Node.js 20+

The web app needs Python and Node.js. The desktop build additionally needs a
Rust toolchain and Tauri's platform-specific system dependencies. Ollama will
be needed later for RAG chat.

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000   # http://127.0.0.1:8000
pytest                                       # run the test suite
```

The SQLite database is created automatically at `backend/data/devpilot.db`
on first run.

## Frontend

```bash
cd frontend
npm install

npm run dev      # http://localhost:5173 — expects the backend on :8000
npm test         # vitest
npm run build    # production build
```

To point the frontend at a backend running on a different port, set
`VITE_API_BASE_URL` in `frontend/.env.local`.

## Desktop app (Tauri)

The Tauri app bundles the React frontend and a PyInstaller-built FastAPI
sidecar. It starts the backend automatically on an available loopback port and
stores SQLite data in the operating system's application-data directory.

Install the desktop dependencies once:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-desktop.txt

cd ../frontend
npm install
```

Install Rust and the system packages listed in the
[official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). On
Debian/Ubuntu, the main packages are:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Then run or build the desktop app:

```bash
cd frontend
npm run desktop:dev
npm run desktop:build
```

The installer/package is written under `frontend/src-tauri/target/release/bundle/`.
Desktop packages must be built on each target operating system. The integrated
PTY terminal currently supports Linux and macOS shells.

## Using it

1. For web development, start the backend (`uvicorn app.main:app --reload --port 8000`).
2. Start the frontend (`npm run dev`) and open http://localhost:5173. For the
   desktop app, use `npm run desktop:dev` instead; it starts its own backend.
3. Enter an absolute path to a local Git repository and click
   "Open repository". The file tree appears once indexing completes.
4. Select a file in **File Explorer** to view its source and symbol outline.
   Open **Code Editor** from the sidebar to edit files directly, or click
   **Edit** in the file preview. Make changes, then **Save** or press **Ctrl/Cmd+S**. **Tab**
   inserts the configured indentation. **Discard** returns to the saved source.

The editor saves UTF-8 text files up to 500 KB directly to the opened project.
It preserves CRLF line endings and file permissions, refreshes metadata and
symbols, and asks before leaving unsaved changes. Binary files, symbolic links,
read-only files, and partial previews cannot be edited. If another program
changes the file, saving reports a conflict and keeps your draft; copy your
edits, then discard and reopen the file to load the latest version.

API: `GET /api/files/{id}/content` includes an editability flag and content hash.
`PUT /api/files/{id}/content` accepts `content` and `expected_hash`; a stale hash
returns HTTP 409. Symbols are available at `GET /api/files/{id}/symbols`.

**Code Editor** uses a compact VS Code-style workspace with file tabs,
breadcrumbs, a resizable explorer, syntax highlighting, code folding,
undo/redo, and cursor/encoding information. **Ctrl/Cmd+P** searches project
files; **Ctrl/Cmd+F** searches the current file. Toolbar controls toggle the
explorer, word wrap, and symbol outline. The editor follows the workspace
theme and indentation preferences and loads its editor engine locally.
Its explorer lists local files including untracked files, `.env`, hidden
folders, and files excluded by `.gitignore`. Refresh local files to pick up
new files created outside IFROG. This complete listing applies only to Code
Editor; File Explorer, AI indexing, and analytics keep their existing filters.
Editor-only files are read and saved directly without adding them to that index.

## Git Repository dashboard

Open a local repository and select **Git Repository** in the sidebar to see
the original **Repository Details**, **Branch & Commit**, and **Git Activity**
cards. Repository metadata comes from the opened project; the activity list,
branch diagram, and missing-metadata fallbacks are demo content. The original
**Open on GitHub** button opens this project's fixed GitHub URL, not the
selected repository's remote. This view does not poll Git, show diffs, or
send Git review prompts to AI.

API: `GET /api/repositories/{id}/git` returns current metadata, changes, and
recent commits; `GET /api/repositories/{id}/git/diff?path=main.py&staged=false`
returns the selected file's patch.

## Workspace settings

Settings save automatically on the current device. Appearance controls apply
theme (including system theme changes), interface scale, sidebar position,
and accent color. Editor controls configure tabs, wrapping, and line numbers
in the source preview. AI defaults select Gemini or Codex for new threads and
control whether responses appear while streaming or after completion. The
saved Git refresh preference is inactive on the original dashboard. Desktop
update checks can be disabled. Reset preferences restores these defaults while preserving opened
projects and conversation data.

## Project layout

```
backend/    FastAPI + SQLAlchemy + GitPython (clean architecture — see docs/ARCHITECTURE.md)
frontend/   Vite + React + TypeScript
docs/       Architecture and milestone documentation
```
# AI-codbase-assistand

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
4. Symbols (classes/functions/methods/imports) extracted per file aren't in
   the UI yet — fetch them directly: `GET /api/files/{file_id}/symbols`
   (the file's `file_id` is in the tree response).

## Project layout

```
backend/    FastAPI + SQLAlchemy + GitPython (clean architecture — see docs/ARCHITECTURE.md)
frontend/   Vite + React + TypeScript
docs/       Architecture and milestone documentation
```
# AI-codbase-assistand

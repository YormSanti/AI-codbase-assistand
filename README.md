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

Not required yet, but will be for later milestones: a Rust toolchain (for
the Tauri desktop shell) and [Ollama](https://ollama.com) (for RAG chat).

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

## Using it

1. Start the backend (`uvicorn app.main:app --reload --port 8000`).
2. Start the frontend (`npm run dev`) and open http://localhost:5173.
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

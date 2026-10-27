# DevPilot AI

An AI-powered Developer Intelligence Platform: repository indexing, code
parsing, semantic search, RAG-based chat, architecture visualization, Git
intelligence, and project health/security analysis.

Built incrementally — see [`docs/MILESTONES.md`](docs/MILESTONES.md) for
what's done and what's next, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the clean-architecture layout.

## Status

Working today: open a local project and index it (incrementally on reopen),
parse Python/JS/TS symbols with Tree-sitter, browse and edit files in a
CodeMirror editor with tabs and search, run shells in an integrated
terminal, review diffs and stage/unstage/commit from Source Control, see
live branch, upstream, and commit data on the dashboard and Git page, open a
command palette (Ctrl/Cmd+K) to jump anywhere, and chat with the Codex or
Gemini CLI in the desktop app or the browser. The Code Health page scans for secrets, risky
patterns, complex functions, TODOs, and large files. Semantic search and RAG
chat (Phase 2) and duplicate-code checks are not built yet; see
[`docs/MILESTONES.md`](docs/MILESTONES.md).

The Git Repository page shows live data from the opened repository: branch,
HEAD commit, upstream ahead/behind counts, working tree summary, and recent
commits, refreshed on focus and on the interval chosen in Settings.

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
pytest                                       # run the test suite (CI runs it on every pull request)
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
backend. The backend is a directory bundle (`npm run desktop:backend` writes
it to `frontend/src-tauri/resources/backend`, shipped as a Tauri resource), so
it starts immediately instead of unpacking a single-file executable on every
launch. The app starts it on an available loopback port, waits for its
`/health` check before the first request, and stores SQLite data in the
operating system's application-data directory.

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
3. Enter the full path to a local Git repository (`~/projects/app` works;
   a relative path is rejected) and click "Open repository". The file tree appears once indexing completes.
4. Select a file in **File Explorer** to view its source and symbol outline.
   The `{}` badge beside a file name counts its classes, functions, and methods.
   Open **code** near Settings at the bottom of the sidebar to edit files directly, or click
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
Each open file keeps its own draft, cursor, and undo history when switching
tabs. Dirty dots and the status bar show unsaved files. **Save All** or
**Ctrl/Cmd+Shift+S** saves every modified tab; a conflict keeps that file's
draft and selects it for review. Close a tab with **Ctrl/Cmd+W** and switch
tabs with **Ctrl/Cmd+Alt+Left/Right**. The toolbar provides Undo, Redo, and
Find/Replace; **Ctrl/Cmd+G** or the line/column indicator opens Go to Line.
Its explorer lists local files including untracked files, `.env`, hidden
folders, and files excluded by `.gitignore`. Refresh local files to pick up
new files created outside IFROG. This complete listing applies only to Code
Editor; File Explorer, AI indexing, and analytics keep their existing filters.
Editor-only files are read and saved directly without adding them to that index.
Opening a folder inside a Git repository keeps that selected folder as the
workspace root. For example, opening `frontend` lists files inside `frontend`
and starts its terminal there. Git status and diffs use the containing repository.

Click **code** near Settings to enter the dedicated **IFROG Editor** app inside the
same window. It fills the workspace and provides its own toolbar and navigation
rail. The compact menu bar provides File, Edit, Selection, View, Go, Terminal,
and Help actions, with project file search in the center. **View** toggles the
Explorer, symbol outline, word wrap, and clickable code minimap. **Help** shows
keyboard shortcuts. **Back to IFROG** returns to the dashboard; **File > File
Explorer** opens the shared File Explorer. The rail toggles the Explorer and
opens file search, Git Repository, AI Assistant, or editor settings. Switching between File
Explorer and the editor retains all open file drafts, including editor-only
files hidden from File Explorer. Leaving the workspace, changing projects,
or closing IFROG asks before discarding any unsaved files.

**Go to Symbol in Workspace** (**Ctrl/Cmd+T**, **Go > Go to Symbol in
Workspace…**, or `#` at the start of **Go to File**) searches the indexed
classes, functions, and methods by name. Exact names rank first, then
prefixes, then other matches; methods show their class. Enter opens the
file at the definition. Symbols come from the Tree-sitter index, so they
cover Python, JavaScript, and TypeScript files. API:
`GET /api/repositories/{id}/symbols?q=name&limit=50`.

**Search in files** (**Ctrl/Cmd+Shift+F**, the rail's magnifier-with-text
icon, or **Edit > Search in Files…**) runs a plain-text search across every
text file in the project, with a match-case toggle. Results group by file;
click a line to open that file in the editor with the cursor on the match.
Dependency and build folders such as `node_modules`, `.venv`, `dist`, and
`target` are skipped, files over 500 KB and binary files are ignored, and the
scan stops after 500 matches or a few seconds and says so. API:
`GET /api/repositories/{id}/editor/search?q=text&case_sensitive=false&limit=200`.

Inside the editor, click the **Git Repository** rail icon or choose
**View > Git Repository** to open Source Control. The repository overview
shows the current branch, upstream ahead/behind counts, and recent commits.
Changed files are grouped into staged changes, working-tree changes, and
merge conflicts. Select a file for a split or unified diff; staged and
working-tree versions are reviewed separately. Refresh reloads status and
diffs after Git commands in the terminal. Open files, drafts, undo history,
and the terminal stay available while reviewing Git. **Back to code** or
**Ctrl/Cmd+P** returns to the file workspace.

Below the commit box, the sync row shows the upstream with **Fetch**,
**Pull** (with the number of commits behind), and **Push** (with the number
ahead). Pull only fast-forwards, so it never creates a merge commit and
stops with Git's message when histories have diverged; it is refused while
the editor has unsaved drafts, and afterwards open clean tabs and the index
refresh. Push never forces; a branch without an upstream shows **Publish**,
which pushes it and sets the upstream. These commands never wait on a
hidden password prompt: credential helpers, SSH agents, and askpass programs
work, anything else fails within two minutes with Git's own error. API:
`POST /api/repositories/{id}/git/fetch`, `.../git/pull`, `.../git/push`.

Click the branch name under the project in the Source Control sidebar to
switch branches: the list shows local branches, most recent first, with
their upstream. Typing a name that does not exist offers **Create branch …
from here**, which branches from the current commit and switches to it
(uncommitted changes come along). Switching to an existing branch is refused
while tracked files have uncommitted changes or the editor has unsaved
drafts; after a switch the editor's file list, open clean tabs, and the
project index refresh. API: `GET /api/repositories/{id}/git/branches`,
`POST .../git/checkout` with `{ "branch": "..." }`, and `POST .../git/branches`
with `{ "name": "...", "checkout": true }`.

The **History** button on an editor tab lists the commits that changed that
file, newest first, following renames (it works in a subfolder workspace
too). Open one to see the commit with that file's diff already selected;
**History** in the commit toolbar goes back to the list. API:
`GET /api/repositories/{id}/git/history?path=...&limit=50`.

Click a commit in the overview's history to open it: the message and body,
author, date, parent (merges are compared with their first parent), and the
changed files with their status and added/removed line counts. Select a
file to see its diff in split or unified view, or draft an AI review of it.
API: `GET /api/repositories/{id}/git/commits/{sha}` and
`GET /api/repositories/{id}/git/commits/{sha}/diff?path=...`.

**Review with AI** in a diff's toolbar drafts a review request for that file
(staged, working tree, or merge conflict) and opens the editor's AI
Assistant with the draft in the composer, ready to edit and send. Diffs are
clipped to 20,000 characters and the draft says when that happened. The
composer is multi-line (**Shift+Enter** adds a line, **Enter** sends), long
messages in the conversation collapse behind **Show more**, and follow-ups
replay only as many recent turns as fit the CLI's prompt limit.

The sparkle button inside the commit box writes a commit message for the
staged changes with your default AI provider. It sends the
staged file list, the staged diff, and recent commit subjects so the message
matches the project's style, then puts the reply in the box for you to edit;
nothing is committed until you press **Commit**. The sparkle in the **Staged
Changes** header drafts an AI review of everything staged. API:
`GET /api/repositories/{id}/git/staged-diff` returns the combined staged
patch, a `--stat` summary, and the file count.

Stage and commit without leaving the view: hover a changed file for its
**+** (stage) or **−** (unstage) button, use the group buttons to stage or
unstage everything in a section, and mark a resolved merge conflict with
**+**. The **↶** button on a working-tree change discards it (tracked files
return to their staged or committed version, untracked files are deleted),
and the **Changes** header's **↶** discards the whole group; both ask first
in an in-app dialog, never touch staged changes or merge conflicts, and
reload any open editor tab of that file that has no unsaved edits. Type a
message in the commit box and press **Commit** or
**Ctrl/Cmd+Enter**; the button shows how many files are staged and stays
disabled until there is a message and something staged. Git's own error text
is shown when a commit is rejected, for example when no identity is
configured or a hook fails. Pushing and pulling still happen in the terminal.

API: `POST /api/repositories/{id}/git/stage` and `.../git/unstage` take
`{ "paths": [...] }` limited to currently changed files;
`POST /api/repositories/{id}/git/commit` takes `{ "message": "..." }`, and
`POST /api/repositories/{id}/git/discard` takes `{ "paths": [...] }`. Each
returns the refreshed Git status.

Use **Terminal** or **Ctrl/Cmd+\`** to show a resizable terminal below the
editor. It starts in the opened project folder and keeps its session when
hidden or when switching to File Explorer. A project switch closes the old
editor terminal; if the panel is open, a terminal starts in the new project.
Leaving the file workspace closes its integrated terminal. The separate
Terminal page continues to keep its existing sessions for each project.

The dedicated editor app lives in `frontend/src/editor/EditorApp.tsx` and
`EditorApp.css`. It shares the file workspace, CodeMirror engine, file APIs,
and save/conflict handling with the existing File Explorer.

## AI in the browser

The AI features (chat, Review with AI, commit messages, provider status)
work in the web build as well as the desktop app. The desktop app runs the
Codex or Gemini CLI through Tauri; the browser build asks the local backend
to run the same CLI with the same flags (Codex in its read-only sandbox) in
the selected project's folder and streams the reply back. The CLI must be
installed and signed in on the machine running the backend; if it is not,
the AI page says so and suggests running `codex login` or `gemini` on the
Terminal page. API: `GET /api/agent/providers` and `POST /api/agent/run`
(`{ "provider", "prompt", "repository_id" }`, streamed as newline-delimited
JSON `chunk` events followed by `done` or `error`).

## AI conversations

Conversations with Codex or Gemini are saved per project and thread on this
device, so they survive restarts, project switches, and threads that were
closed to save memory. The editor's AI view keeps its own conversation per
project. A new sidebar thread is named after its first message. **New
thread** or **Clear conversation** empties the current one, and removing a
thread or a project deletes its saved conversations. The newest 120 messages
(about 400 KB) per conversation are kept.

## Command palette

Press **Ctrl/Cmd+K** (or **Ctrl/Cmd+Shift+P** anywhere, including the code
editor and terminal where Ctrl+K has its own meaning) or click **Commands**
in the header to open the command palette. Type to filter, use the arrow
keys, and press Enter. It lists every page, each project IFROG has opened
before (switching projects without the sidebar), **Open Source Control**,
**Search in files**, and **Go to symbol in workspace** (which enter the editor
with that view already open),
**Re-index project**, and a theme switch. Entries that need a project are
hidden until one is open.

## Code Health

**Code Health** in the sidebar (also in the command palette, and linked from
Analytics) scans the project's indexed text files and groups what it finds:

- **Possible secrets**: private keys; AWS, GitHub, GitLab, Slack (tokens
  and webhook URLs), Google, Stripe, OpenAI, Anthropic, npm, PyPI, Hugging
  Face, and SendGrid key formats; database URLs with a password in them; and
  string literals assigned to names like `password` or `api_key`. Values are
  redacted before they leave the backend, and placeholders such as
  `changeme` or `${TOKEN}` are ignored.
- **Risky patterns**: `eval`, Python `exec`, `shell=True`, `os.system`,
  `os.popen`, `pickle`, `marshal`, `yaml.load` without a safe loader,
  disabled TLS verification (including `ssl._create_unverified_context`),
  MD5/SHA-1, SQL built with f-strings, `%`, or `.format()`, shell commands
  built from JavaScript template strings, `tempfile.mktemp`, Flask
  `debug=True`, `dangerouslySetInnerHTML`, `innerHTML =`, `document.write`,
  `new Function`, `chmod 777`, and `curl | sh`.
- **Complex functions**: Python, JavaScript, and TypeScript functions with a
  cyclomatic complexity of 15 or more (25 or more is medium severity). The
  score is 1 plus each `if`/`elif`, loop, `except`/`catch`, `case`, ternary,
  comprehension clause, and `and`/`or`/`&&`/`||`/`??`; nested functions are
  scored on their own.
- **TODO and FIXME**: `TODO`, `FIXME`, `HACK`, `XXX`, and `BUG` in comments.
- **Large files**: indexed files of 512 KB or more.

Click **Open** on a finding to jump to that line in the editor. The checks
are heuristics; add `ifrog-ignore` to a line, or `ifrog-ignore-file` in a
file's first ten lines, to silence them. Files ignored by Git, lock files,
minified bundles, binaries, and files over 1 MB are not scanned. API:
`GET /api/repositories/{id}/health`.

## Dashboard

The Dashboard shows live state only: indexed file count and when the index
was last built, the current branch and upstream, the working tree summary,
language breakdown, the latest commits, and a system status panel that pings
the backend `/health` endpoint and reports whether the
Codex and Gemini CLIs are installed and signed in. **Re-index** rescans the
working tree and rebuilds every symbol via `POST /api/repositories/{id}/reindex`.
Quick actions link only to pages that exist.

## Git Repository dashboard

Open a local repository and select **Git Repository** in the sidebar to see
the **Repository Details**, **Branch & Commit**, and **Git Activity** cards.
Everything shown is live: the current branch, HEAD commit (click to copy),
upstream with ahead/behind counts, the working tree summary (staged,
unstaged, conflicts), and the recent commit list from `git log`. **Open
remote** opens the selected repository's own remote URL. The page refreshes
when the window regains focus and on the Git refresh interval from Settings;
**Refresh** reloads on demand. Diffs, staging, and AI review live in the
editor's Source Control view (**Review changes in editor**).

API: `GET /api/repositories/{id}/git` returns current metadata, changes, and
recent commits; `GET /api/repositories/{id}/git/diff?path=main.py&staged=false`
returns the selected file's patch.

## Workspace settings

Settings save automatically on the current device. Appearance controls apply
theme (including system theme changes), interface scale, sidebar position,
and accent color. Editor controls configure tabs, wrapping, and line numbers
in the source preview. AI defaults select Gemini or Codex for new threads and
control whether responses appear while streaming or after completion. The
Git refresh interval controls how often the Dashboard and Git Repository
pages reload status; both also refresh when the window regains focus. Desktop
update checks can be disabled. Reset preferences restores these defaults while preserving opened
projects and conversation data.

## Project layout

```
backend/    FastAPI + SQLAlchemy + GitPython (clean architecture — see docs/ARCHITECTURE.md)
frontend/   Vite + React + TypeScript
docs/       Architecture and milestone documentation
```
# AI-codbase-assistand

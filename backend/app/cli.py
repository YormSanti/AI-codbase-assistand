"""Command Line Interface (CLI) for DevPilot AI.

Enables developers to index repositories, inspect symbols, view Git status,
manage workspaces, and run servers directly from the terminal.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from contextlib import contextmanager

from app.config import settings
from app.infrastructure.db.database import SessionLocal, init_db
from app.infrastructure.db.sqlite_repository import SqlAlchemyFileMetadataRepository
from app.infrastructure.db.sqlite_symbol_repository import SqlAlchemySymbolRepository
from app.infrastructure.git.git_client import GitPythonClient
from app.infrastructure.git.git_review_client import GitReviewClient
from app.infrastructure.parsing.file_scanner import scan_files
from app.infrastructure.parsing.treesitter_parser import TreeSitterCodeParser
from app.services.git_review_service import GitReviewService
from app.services.indexing_service import IndexingService
from app.services.parsing_service import SymbolExtractionService

__version__ = "1.0.0"

# ---------------------------------------------------------------------------
# ANSI colour helpers – auto-disabled when stdout is not a TTY
# ---------------------------------------------------------------------------

_NO_COLOR = not sys.stdout.isatty() or os.environ.get("NO_COLOR")


def _c(text: str, *codes: int) -> str:
    """Wrap *text* in ANSI escape codes when colour is available."""
    if _NO_COLOR:
        return text
    csi = "\033["
    reset = f"{csi}0m"
    return f"{csi}{';'.join(str(c) for c in codes)}m{text}{reset}"


def dim(t: str) -> str:
    return _c(t, 2)


def bold(t: str) -> str:
    return _c(t, 1)


def green(t: str) -> str:
    return _c(t, 32)


def yellow(t: str) -> str:
    return _c(t, 33)


def red(t: str) -> str:
    return _c(t, 31)


def cyan(t: str) -> str:
    return _c(t, 36)


def magenta(t: str) -> str:
    return _c(t, 35)


def blue(t: str) -> str:
    return _c(t, 34)


def _hr(char: str = "─", width: int = 56) -> str:
    return dim(char * width)


def _ok(msg: str) -> None:
    print(f"{green('✓')} {msg}")


def _warn(msg: str) -> None:
    print(f"{yellow('⚠')} {msg}", file=sys.stderr)


def _err(msg: str) -> None:
    print(f"{red('✗')} {msg}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Session / service helpers
# ---------------------------------------------------------------------------

@contextmanager
def session_scope():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _get_services(session):
    file_repo = SqlAlchemyFileMetadataRepository(session)
    symbol_repo = SqlAlchemySymbolRepository(session)
    git_client = GitPythonClient()
    parser = TreeSitterCodeParser()
    extraction_service = SymbolExtractionService(parser=parser, symbol_repository=symbol_repo)
    indexing_service = IndexingService(
        git_client=git_client,
        file_repository=file_repo,
        scan_files=scan_files,
        symbol_extraction_service=extraction_service,
    )
    git_review_service = GitReviewService(file_repo, GitReviewClient())
    return indexing_service, git_review_service, file_repo, symbol_repo


def _resolve_repo(file_repo, target: str):
    """Return a RepoInfo for *target* (ID or path), or None."""
    if target.isdigit():
        return file_repo.get_repository(int(target))
    p = str(Path(target).expanduser().resolve())
    return file_repo.find_repository_by_path(p)


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------

def cmd_index(args: argparse.Namespace) -> int:
    path = Path(args.path).expanduser().resolve()
    if not path.exists():
        _err(f"Directory does not exist: {path}")
        return 1

    init_db()
    with session_scope() as session:
        indexing_service, _, file_repo, symbol_repo = _get_services(session)
        print(f"Indexing {cyan(str(path))} …")
        try:
            info = indexing_service.open_repository(str(path))
        except Exception as e:
            _err(f"Failed to index repository: {e}")
            return 1

        files = file_repo.list_files(info.id)
        total_symbols = 0
        kinds_count: dict[str, int] = {}
        for f in files:
            symbols = symbol_repo.list_symbols_for_file(f.id)
            total_symbols += len(symbols)
            for s in symbols:
                kinds_count[s.kind.value] = kinds_count.get(s.kind.value, 0) + 1

        if args.json:
            print(json.dumps({
                "id": info.id,
                "name": info.name,
                "root_path": info.root_path,
                "current_branch": info.current_branch,
                "head_commit": info.head_commit,
                "file_count": info.file_count,
                "symbol_count": total_symbols,
                "symbol_kinds": kinds_count,
            }, indent=2))
        else:
            print(_hr())
            print(f"  {bold('Repository ID')}   {info.id}")
            print(f"  {bold('Name')}            {info.name}")
            print(f"  {bold('Root')}            {info.root_path}")
            print(f"  {bold('Branch')}          {green(info.current_branch or 'detached')}")
            print(f"  {bold('Head Commit')}     {dim(info.head_commit or 'none')}")
            print(f"  {bold('Tracked Files')}   {info.file_count}")
            print(f"  {bold('Symbols')}         {total_symbols}")
            if kinds_count:
                for kind, count in sorted(kinds_count.items()):
                    print(f"    {dim('·')} {kind.title()}s: {count}")
            print(_hr())
            _ok("Indexing completed successfully.")
    return 0


def cmd_reindex(args: argparse.Namespace) -> int:
    """Re-index an already-tracked repository to pick up new/changed files."""
    init_db()
    with session_scope() as session:
        file_repo = SqlAlchemyFileMetadataRepository(session)
        repo_info = _resolve_repo(file_repo, args.target)
        if not repo_info:
            _err(f"Repository not found: {args.target}. Run 'devpilot index <path>' first.")
            return 1

    # Delegate to cmd_index with the resolved path
    args.path = repo_info.root_path
    args.json = getattr(args, "json", False)
    return cmd_index(args)


def cmd_list(args: argparse.Namespace) -> int:
    init_db()
    with session_scope() as session:
        file_repo = SqlAlchemyFileMetadataRepository(session)
        repos = file_repo.list_repositories()
        if not repos:
            if args.json:
                print("[]")
            else:
                print(dim("No indexed repositories found."))
                print(dim("  Tip: run ") + cyan("devpilot index <path>") + dim(" to add one."))
            return 0

        if args.json:
            print(json.dumps([
                {
                    "id": r.id,
                    "name": r.name,
                    "root_path": r.root_path,
                    "current_branch": r.current_branch,
                    "file_count": r.file_count,
                }
                for r in repos
            ], indent=2))
        else:
            print(f"Found {bold(str(len(repos)))} indexed repository(ies):\n")
            print(f"  {bold('ID'):4}  {bold('Branch'):14}  {bold('Files'):6}  {bold('Path')}")
            print(f"  {dim('─' * 4)}  {dim('─' * 14)}  {dim('─' * 6)}  {dim('─' * 40)}")
            for r in repos:
                branch = green((r.current_branch or "detached")[:14])
                print(f"  {r.id:<4}  {branch:<25}  {r.file_count:<6}  {r.root_path}")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    init_db()
    with session_scope() as session:
        _, git_review_service, file_repo, _ = _get_services(session)
        target = args.target

        repo_info = None
        if target:
            repo_info = _resolve_repo(file_repo, target)

        if not repo_info:
            repos = file_repo.list_repositories()
            if repos:
                repo_info = repos[0]

        if not repo_info:
            _err("No repository specified or found. Run 'devpilot index <path>' first.")
            return 1

        try:
            overview = git_review_service.get_status(repo_info.id)
        except Exception as e:
            _err(f"Failed to fetch Git status: {e}")
            return 1

        if args.json:
            print(json.dumps({
                "name": repo_info.name,
                "root_path": repo_info.root_path,
                "branch": overview.branch,
                "upstream": overview.upstream,
                "ahead": overview.ahead or 0,
                "behind": overview.behind or 0,
                "head_commit": overview.head_commit,
                "changes": [
                    {
                        "path": c.path,
                        "index_status": c.index_status,
                        "worktree_status": c.worktree_status,
                    }
                    for c in overview.changes
                ],
                "commits": [
                    {
                        "sha": c.sha,
                        "message": c.message,
                        "author": c.author,
                    }
                    for c in (overview.commits or [])[:10]
                ],
            }, indent=2))
        else:
            name_str = bold(repo_info.name)
            path_str = dim(f"({repo_info.root_path})")
            print(f"\n{cyan('◈')} {name_str} {path_str}\n")
            print(f"  {bold('Branch')}    {green(overview.branch or 'detached')}")
            upstream_str = overview.upstream or dim("none")
            ahead = overview.ahead or 0
            behind = overview.behind or 0
            sync_str = f"{green('↑' + str(ahead))} {red('↓' + str(behind))}" if (ahead or behind) else green("up-to-date")
            print(f"  {bold('Upstream')}  {upstream_str}  {sync_str}")
            sha_str = dim(overview.head_commit[:8]) if overview.head_commit else dim("none")
            print(f"  {bold('Commit')}    {sha_str}\n")

            if overview.changes:
                print(f"  {bold('Changes')} ({len(overview.changes)} file(s)):")
                for change in overview.changes:
                    idx = change.index_status or "·"
                    wt = change.worktree_status or "·"
                    st_color = yellow if wt != "·" else green
                    st = st_color(f"[{idx}/{wt}]")
                    print(f"    {st}  {change.path}")
            else:
                print(f"  {green('No uncommitted changes.')}")

            if overview.commits:
                print(f"\n  {bold('Recent Commits')}:")
                for c in overview.commits[:7]:
                    sha = dim(c.sha[:7])
                    msg = (c.message.splitlines()[0] if c.message else "")[:60]
                    author = dim(f"({c.author})")
                    print(f"    {sha}  {msg}  {author}")
            print()
    return 0


def cmd_symbols(args: argparse.Namespace) -> int:
    init_db()
    with session_scope() as session:
        _, _, file_repo, symbol_repo = _get_services(session)
        repo_info = _resolve_repo(file_repo, args.target)

        if not repo_info:
            _err(f"Repository not found: {args.target}")
            return 1

        files = file_repo.list_files(repo_info.id)
        file_filter = args.file
        kind_filter = (args.kind or "").lower() or None

        if args.json:
            result = []
            for f in files:
                if file_filter and file_filter not in f.relative_path:
                    continue
                symbols = symbol_repo.list_symbols_for_file(f.id)
                if kind_filter:
                    symbols = [s for s in symbols if s.kind.value.lower() == kind_filter]
                if not symbols:
                    continue
                result.append({
                    "file": f.relative_path,
                    "symbols": [
                        {
                            "name": s.name,
                            "kind": s.kind.value,
                            "parent": s.parent_name,
                            "start_line": s.start_line,
                            "end_line": s.end_line,
                        }
                        for s in symbols
                    ],
                })
            print(json.dumps(result, indent=2))
        else:
            matched = 0
            for f in files:
                if file_filter and file_filter not in f.relative_path:
                    continue
                symbols = symbol_repo.list_symbols_for_file(f.id)
                if kind_filter:
                    symbols = [s for s in symbols if s.kind.value.lower() == kind_filter]
                if not symbols:
                    continue
                matched += 1
                print(f"\n{cyan(f.relative_path)} {dim(f'({len(symbols)} symbols)')}")
                for s in symbols:
                    parent = f" {dim('[' + s.parent_name + ']')}" if s.parent_name else ""
                    kind_str = magenta(f"{s.kind.value:<8}")
                    loc_str = dim(f"L{s.start_line}-{s.end_line}")
                    print(f"  {kind_str}  {bold(s.name)}{parent}  {loc_str}")

            if matched == 0:
                print(dim("No symbols found matching filter."))
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    """Run an arbitrary shell command inside a repository's working directory."""
    init_db()
    with session_scope() as session:
        file_repo = SqlAlchemyFileMetadataRepository(session)
        target = args.target or "."

        if target.isdigit():
            repo_info = _resolve_repo(file_repo, target)
            if not repo_info:
                _err(f"Repository not found: {target}")
                return 1
            cwd = Path(repo_info.root_path)
        else:
            path = Path(target).expanduser().resolve()
            if not path.is_dir():
                _err(f"Directory does not exist: {path}")
                return 1
            cwd = path

    # Strip the optional '--' separator that helps avoid flag ambiguity
    cmd_args = [a for a in (args.cmd_args or []) if a != "--"]
    if not cmd_args:
        _err("No command provided. Usage: devpilot run [target] -- <command> [args…]")
        return 1

    print(dim(f"$ {' '.join(cmd_args)}") + "  " + dim(f"[{cwd}]"))
    try:
        result = subprocess.run(cmd_args, cwd=cwd)
        return result.returncode
    except FileNotFoundError:
        _err(f"Command not found: {cmd_args[0]}")
        return 127
    except KeyboardInterrupt:
        return 130


def cmd_serve(args: argparse.Namespace) -> int:
    import uvicorn
    print(f"{cyan('◈')} Starting {bold('DevPilot')} backend on {green(f'http://{args.host}:{args.port}')}")
    if args.reload:
        print(dim("  Auto-reload enabled (development mode)"))
    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=args.reload)
    return 0


def cmd_info(args: argparse.Namespace) -> int:
    data = {
        "version": __version__,
        "database_url": str(settings.database_url),
        "shell": os.environ.get("SHELL", "unknown"),
        "python": sys.version.split()[0],
        "python_exe": sys.executable,
        "cwd": os.getcwd(),
    }
    if args.json:
        print(json.dumps(data, indent=2))
    else:
        print(f"\n{cyan('◈')} {bold('DevPilot AI')} {dim('v' + __version__)} — Developer Intelligence Platform\n")
        print(f"  {bold('Database')}    {dim(data['database_url'])}")
        print(f"  {bold('Shell')}       {data['shell']}")
        print(f"  {bold('Python')}      {data['python']}  {dim(data['python_exe'])}")
        print(f"  {bold('Working Dir')} {data['cwd']}\n")
    return 0


# ---------------------------------------------------------------------------
# Argument parser
# ---------------------------------------------------------------------------

def _add_json_flag(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--json",
        action="store_true",
        default=False,
        help="Output machine-readable JSON instead of human-friendly text",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="devpilot",
        description=f"{bold('DevPilot AI')} — Repository intelligence and developer tools",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=dim(
            "Examples:\n"
            "  devpilot index ~/projects/myapp\n"
            "  devpilot status\n"
            "  devpilot symbols 1 --file api.py --kind function\n"
            "  devpilot run 1 -- git log --oneline -10\n"
            "  devpilot serve --port 8080\n"
        ),
    )
    parser.add_argument(
        "--version", "-V",
        action="version",
        version=f"devpilot {__version__}",
    )
    subparsers = parser.add_subparsers(dest="command", metavar="<command>")

    # index
    index_parser = subparsers.add_parser(
        "index",
        help="Index a Git repository and extract symbols",
        description="Scan a Git repository, persist file metadata and code symbols to the local database.",
    )
    index_parser.add_argument("path", help="Path to Git repository root")
    _add_json_flag(index_parser)

    # reindex
    reindex_parser = subparsers.add_parser(
        "reindex",
        help="Re-index an already-tracked repository",
        description="Re-scan a repository that was previously indexed to pick up new or changed files.",
    )
    reindex_parser.add_argument(
        "target",
        help="Repository ID (from 'devpilot list') or path",
    )
    _add_json_flag(reindex_parser)

    # list
    list_parser = subparsers.add_parser(
        "list",
        help="List all indexed repositories",
        description="Show every repository currently tracked in the DevPilot database.",
    )
    _add_json_flag(list_parser)

    # status
    status_parser = subparsers.add_parser(
        "status",
        help="Show Git status and recent commits",
        description="Display branch, upstream sync, staged/unstaged changes and recent commits for a repository.",
    )
    status_parser.add_argument(
        "target",
        nargs="?",
        default="",
        help="Repository ID or root path (defaults to the most recently indexed repository)",
    )
    _add_json_flag(status_parser)

    # symbols
    symbols_parser = subparsers.add_parser(
        "symbols",
        help="List extracted code symbols",
        description="Show functions, classes, variables, and other code symbols extracted from a repository.",
    )
    symbols_parser.add_argument("target", help="Repository ID or root path")
    symbols_parser.add_argument(
        "--file", "-f",
        default=None,
        metavar="PATTERN",
        help="Filter by relative file path substring",
    )
    symbols_parser.add_argument(
        "--kind", "-k",
        default=None,
        metavar="KIND",
        help="Filter by symbol kind: function, class, method, variable …",
    )
    _add_json_flag(symbols_parser)

    # run
    run_parser = subparsers.add_parser(
        "run",
        help="Run a shell command inside a repository directory",
        description=(
            "Execute an arbitrary command in a repository's root directory. "
            "Useful for quick one-off git, npm, or make invocations from any working directory."
        ),
    )
    run_parser.add_argument(
        "target",
        nargs="?",
        default=".",
        help="Repository ID, path, or '.' for the current directory",
    )
    run_parser.add_argument(
        "cmd_args",
        nargs=argparse.REMAINDER,
        metavar="-- CMD [ARGS…]",
        help="Shell command to execute (prefix with -- to separate from devpilot flags)",
    )

    # serve
    serve_parser = subparsers.add_parser(
        "serve",
        help="Start the DevPilot backend HTTP server",
        description="Launch the FastAPI backend server that powers the DevPilot desktop and web apps.",
    )
    serve_parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Bind address (default: 127.0.0.1)",
    )
    serve_parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port number (default: 8000)",
    )
    serve_parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload on code change (development mode)",
    )

    # info
    info_parser = subparsers.add_parser(
        "info",
        help="Display environment and system information",
        description="Show version, database path, shell, Python runtime, and current working directory.",
    )
    _add_json_flag(info_parser)

    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 0

    commands = {
        "index": cmd_index,
        "reindex": cmd_reindex,
        "list": cmd_list,
        "status": cmd_status,
        "symbols": cmd_symbols,
        "run": cmd_run,
        "serve": cmd_serve,
        "info": cmd_info,
    }

    handler = commands.get(args.command)
    if not handler:
        parser.print_help()
        return 1

    return handler(args)


if __name__ == "__main__":
    sys.exit(main())

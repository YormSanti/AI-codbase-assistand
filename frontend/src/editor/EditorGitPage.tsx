import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, CheckCircle2, ChevronDown, ChevronRight, Columns2, Copy, ExternalLink, FileCode2, GitBranch, GitCommitHorizontal, History, List, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import type { RepositoryInfo } from "../types/domain";
import type { GitChange } from "../types/git";
import { groupChanges, useGitReview, type ChangeGroup } from "./useGitReview";
import { parseGitDiff, splitGitDiff, type DiffLine } from "./gitDiff";
import "./EditorGitPage.css";

interface Props {
  repository: RepositoryInfo | null;
  active: boolean;
  onReturn: () => void;
  onOpenFolder: () => void;
}

const groupNames: Record<ChangeGroup, string> = { conflicts: "Merge Changes", staged: "Staged Changes", changes: "Changes" };
const changeNames: Record<string, string> = { M: "Modified", A: "Added", D: "Deleted", R: "Renamed", C: "Copied", "?": "Untracked", U: "Conflict" };
function fileName(path: string) { return path.split("/").pop() ?? path; }
function changeCode(change: GitChange, group: ChangeGroup) { return group === "conflicts" ? "U" : group === "staged" ? change.index_status : change.index_status === "?" ? "?" : change.worktree_status; }
function shortDate(date: string) { return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }

function DiffCell({ line, side }: { line: DiffLine | null; side: "old" | "new" }) {
  return <div className={`editor-git-diff-cell ${line ? `is-${line.kind}` : "is-empty"}`}><span className="editor-git-line-number">{line?.[side === "old" ? "oldLine" : "newLine"]}</span><code>{line?.text ?? " "}</code></div>;
}

export function EditorGitPage({ repository, active, onReturn, onOpenFolder }: Props) {
  const review = useGitReview(repository?.id ?? null, active);
  const [expanded, setExpanded] = useState<Record<ChangeGroup, boolean>>({ conflicts: true, staged: true, changes: true });
  const [layout, setLayout] = useState<"split" | "unified">("split");
  const [lineLimit, setLineLimit] = useState(2000);
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const status = review.status;
  const lines = useMemo(() => parseGitDiff(review.patch?.content ?? ""), [review.patch]);
  const visibleLines = useMemo(() => lines.slice(0, lineLimit), [lines, lineLimit]);
  const splitLines = useMemo(() => splitGitDiff(visibleLines), [visibleLines]);
  const added = lines.filter(line => line.kind === "added").length;
  const removed = lines.filter(line => line.kind === "removed").length;
  const groups = (Object.keys(groupNames) as ChangeGroup[]).map(group => ({ group, changes: groupChanges(status?.changes ?? [], group) }));
  const branch = status?.branch ?? (status?.head_commit ? "Detached HEAD" : "No commits yet");

  const copyCommit = async (sha: string) => {
    try {
      if ("__TAURI_INTERNALS__" in window) {
        const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
        await writeText(sha);
      } else await navigator.clipboard.writeText(sha);
      setCopied(sha);
      setNotice(null);
    } catch { setNotice("Could not copy the commit hash."); }
  };
  const openRemote = async () => {
    if (!status?.remote_url) return;
    try {
      if ("__TAURI_INTERNALS__" in window) {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(status.remote_url);
      } else window.open(status.remote_url, "_blank", "noopener,noreferrer");
    } catch { setNotice("Could not open the remote repository."); }
  };

  return <section className="editor-git" aria-label="Editor Git Repository">
    <div className="editor-git-body">
      <aside className="editor-git-sidebar" aria-label="Source Control">
        <header className="editor-git-sidebar-heading"><h2>SOURCE CONTROL</h2><button type="button" aria-label="Refresh Git status" title="Refresh Git status" disabled={!repository || review.loading} onClick={review.refresh}><RefreshCw size={15} className={review.loading ? "editor-git-spin" : undefined} /></button></header>
        {repository && <div className="editor-git-project"><GitBranch size={17} /><div><strong>{repository.name}</strong><span>{status ? branch : review.loading ? "Reading Git repository…" : "Git unavailable"}</span></div><span className="editor-git-count">{status?.changes.length ?? "—"}</span></div>}
        <button type="button" className={`editor-git-overview-link ${!review.selection ? "is-selected" : ""}`} onClick={() => review.select(null)}><History size={15} /><span>Repository overview</span></button>
        <div className="editor-git-change-list">
          {groups.map(({ group, changes }) => changes.length > 0 && <div className="editor-git-change-group" key={group}>
            <button type="button" className="editor-git-group-heading" aria-expanded={expanded[group]} onClick={() => setExpanded(value => ({ ...value, [group]: !value[group] }))}>{expanded[group] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<span>{groupNames[group]}</span><span className="editor-git-count">{changes.length}</span></button>
            {expanded[group] && changes.map(change => {
              const code = changeCode(change, group);
              const selected = review.selection?.path === change.path && review.selection.group === group;
              return <button type="button" key={change.path} className={`editor-git-change ${selected ? "is-selected" : ""}`} aria-label={`${groupNames[group]}: ${change.path}`} aria-pressed={selected} title={`${change.path}${change.original_path ? ` (from ${change.original_path})` : ""}`} onClick={() => { setLineLimit(2000); review.select({ path: change.path, group }); }}>
                <FileCode2 size={14} /><span className="editor-git-change-path"><span>{fileName(change.path)}</span><small>{change.path.includes("/") ? change.path.slice(0, change.path.lastIndexOf("/")) : ""}</small></span><span className={`editor-git-change-code code-${code === "?" ? "untracked" : code}`} title={changeNames[code] ?? code}>{code}</span>
              </button>;
            })}
          </div>)}
          {status && !status.changes.length && <div className="editor-git-sidebar-clean"><CheckCircle2 size={22} /><span>Working tree clean</span></div>}
        </div>
        <div className="editor-git-sidebar-bottom"><GitCommitHorizontal size={14} /><span>{status?.head_commit?.slice(0, 7) ?? "No HEAD commit"}</span><span>Git</span></div>
      </aside>

      <div className="editor-git-main">
        <header className="editor-git-header"><div className="editor-git-tab"><GitBranch size={15} /><span>{review.selection ? fileName(review.selection.path) : "Git Repository"}</span></div><div className="editor-git-header-actions">{status?.remote_url && <button type="button" title={status.remote_url} onClick={() => void openRemote()}><ExternalLink size={14} /><span>Open remote</span></button>}<button type="button" onClick={onReturn}><ArrowLeft size={14} /><span>Back to code</span></button></div></header>
        {review.error && <div className="editor-git-error" role="alert"><TriangleAlert size={15} /><span>{review.error}</span><button type="button" onClick={review.refresh}>Retry</button></div>}
        {notice && <div className="editor-git-error" role="alert">{notice}</div>}
        {!repository ? <div className="editor-git-empty"><GitBranch size={50} /><h1>Open a project to review Git</h1><p>Choose a local folder to see its repository and changes.</p><button type="button" className="editor-git-primary" onClick={onOpenFolder}>Open Folder</button></div>
          : !status ? <div className="editor-git-empty">{review.loading ? <><LoaderCircle className="editor-git-spin" size={28} /><p>Reading repository status…</p></> : <><GitBranch size={42} /><h1>Git is unavailable for this folder</h1><p>Open a folder inside a Git repository to review changes.</p><button type="button" className="editor-git-primary" onClick={onOpenFolder}>Open Folder</button></>}</div>
          : review.selection ? <>
            <div className="editor-git-diff-toolbar"><div><span title={review.selection.path}>{review.selection.path}</span><small>{review.selection.group === "staged" ? "HEAD → Index" : review.selection.group === "conflicts" ? "Merge conflict" : "Index → Working tree"}</small></div><div className="editor-git-diff-controls">{review.patch && <span className="editor-git-diff-stats"><b>+{added}</b><b>−{removed}</b></span>}<button type="button" aria-label="Split diff" aria-pressed={layout === "split" && review.selection.group !== "conflicts"} title={review.selection.group === "conflicts" ? "Merge conflicts use a unified diff" : "Side by side diff"} disabled={review.selection.group === "conflicts"} onClick={() => setLayout("split")}><Columns2 size={15} /></button><button type="button" aria-label="Unified diff" aria-pressed={layout === "unified" || review.selection.group === "conflicts"} title="Unified diff" onClick={() => setLayout("unified")}><List size={15} /></button></div></div>
            {review.diffLoading ? <div className="editor-git-empty"><LoaderCircle className="editor-git-spin" size={24} /><p>Loading diff…</p></div> : review.diffError ? <div className="editor-git-empty" role="alert"><TriangleAlert size={26} /><p>{review.diffError}</p><button type="button" className="editor-git-primary" onClick={review.refresh}>Retry diff</button></div> : review.patch?.is_binary ? <div className="editor-git-empty"><FileCode2 size={35} /><h2>Binary file</h2><p>A text diff is unavailable for this file.</p></div> : !lines.length ? <div className="editor-git-empty"><CheckCircle2 size={28} /><p>No text changes in this diff.</p><button type="button" onClick={review.refresh}>Refresh Git status</button></div> : <div className="editor-git-diff-scroll" role="region" aria-label="File diff" tabIndex={0}>
              {layout === "split" && review.selection.group !== "conflicts" ? <div className="editor-git-split"><div className="editor-git-pane-label">{review.selection.group === "staged" ? "HEAD" : "Index"}</div><div className="editor-git-pane-label">{review.selection.group === "staged" ? "Index" : "Working tree"}</div>{splitLines.map((row, index) => row.note ? <div key={index} className={`editor-git-diff-note is-${row.note.kind}`}>{row.note.text}</div> : <div key={index} className="editor-git-split-row"><DiffCell line={row.left} side="old" /><DiffCell line={row.right} side="new" /></div>)}</div> : <div className="editor-git-unified">{visibleLines.map((line, index) => <div key={index} className={`editor-git-unified-line is-${line.kind}`}><span className="editor-git-line-number">{line.oldLine}</span><span className="editor-git-line-number">{line.newLine}</span><span className="editor-git-line-sign">{line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}</span><code>{line.text}</code></div>)}</div>}
              {(review.patch?.truncated || lines.length > lineLimit) && <div className="editor-git-diff-limit">{lines.length > lineLimit ? <><span>Showing {lineLimit.toLocaleString()} of {lines.length.toLocaleString()} diff lines</span><button type="button" onClick={() => setLineLimit(value => value + 2000)}>Show more</button></> : <span>This diff was truncated by Git preview limits.</span>}</div>}
            </div>}
          </> : <div className="editor-git-overview">
            <div className="editor-git-hero"><div className="editor-git-hero-mark"><GitBranch size={25} /></div><div><p>REPOSITORY</p><h1>{status.remote_url?.split("/").pop() ?? repository.name}</h1><span title={repository.root_path}>{repository.root_path}</span></div><span className="editor-git-branch"><GitBranch size={13} />{branch}</span></div>
            <div className="editor-git-metrics"><div><span>Working tree</span><strong>{status.changes.length ? `${status.changes.length} changed ${status.changes.length === 1 ? "file" : "files"}` : "Working tree clean"}</strong><small>{groupChanges(status.changes, "staged").length} staged · {groupChanges(status.changes, "changes").length} unstaged{groupChanges(status.changes, "conflicts").length ? ` · ${groupChanges(status.changes, "conflicts").length} conflicts` : ""}</small></div><div><span>Upstream</span><strong>{status.upstream ?? "No upstream configured"}</strong><small><ArrowUp size={12} />{status.ahead ?? "—"} ahead <ArrowDown size={12} />{status.behind ?? "—"} behind</small></div><div><span>Latest commit</span><strong className="editor-git-mono">{status.head_commit?.slice(0, 7) ?? "No commits yet"}</strong><small>{status.commits[0]?.message ?? "Make your first commit from the terminal."}</small></div></div>
            <div className="editor-git-history-heading"><div><History size={16} /><h2>Commit history</h2></div><span>{status.commits.length ? `Latest ${status.commits.length} commits` : ""}</span></div>
            {status.commits.length ? <ol className="editor-git-history">{status.commits.map(commit => <li key={commit.sha}><span className="editor-git-history-dot"><GitCommitHorizontal size={17} /></span><div><strong>{commit.message}</strong><span>{commit.author}<span>·</span><time dateTime={commit.committed_at} title={new Date(commit.committed_at).toLocaleString()}>{shortDate(commit.committed_at)}</time></span></div><button type="button" className="editor-git-commit-hash" aria-label={`Copy commit ${commit.sha.slice(0, 7)}`} title={commit.sha} onClick={() => void copyCommit(commit.sha)}><code>{commit.sha.slice(0, 7)}</code>{copied === commit.sha ? <Check size={13} /> : <Copy size={13} />}</button></li>)}</ol> : <div className="editor-git-no-history"><GitCommitHorizontal size={25} /><p>No commits in this repository yet.</p></div>}
          </div>}
        <footer className="editor-git-status"><span><GitBranch size={12} />{status ? branch : "Git Repository"}</span><span>{review.loading ? "Refreshing…" : review.selection ? groupNames[review.selection.group] : "Select a changed file to review its diff"}</span></footer>
      </div>
    </div>
  </section>;
}

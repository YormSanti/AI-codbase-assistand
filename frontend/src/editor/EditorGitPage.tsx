import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowDownToLine, ArrowLeft, ArrowUp, ArrowUpFromLine, Check, CheckCircle2, ChevronDown, ChevronRight, Columns2, Copy, ExternalLink, FileCode2, GitBranch, GitCommitHorizontal, History, List, LoaderCircle, Minus, Plus, RefreshCcw, RefreshCw, Sparkles, TriangleAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { RepositoryInfo } from "../types/domain";
import type { GitChange } from "../types/git";
import { groupChanges, useGitReview, type ChangeGroup } from "./useGitReview";
import { diffCounts, parseGitDiff } from "./gitDiff";
import { DiffView } from "./DiffView";
import { useCommitDetails } from "./useCommitDetails";
import { cleanCommitMessage, commitMessagePrompt, diffReviewPrompt, runAgent, stagedReviewPrompt, type DiffScope } from "../lib/agent";
import { gitApi } from "../api/gitApi";
import { useAppSettings } from "../hooks/useAppSettings";
import { PROVIDER_NAMES } from "../lib/providers";
import { useConfirm } from "../hooks/useConfirm";
import { announceFilesChanged } from "../lib/fileEvents";
import { BranchPicker } from "./BranchPicker";
import type { FileHistory } from "../types/git";
import { formatRelativeTime } from "../lib/time";
import "./EditorGitPage.css";

interface Props {
  repository: RepositoryInfo | null;
  active: boolean;
  onReturn: () => void;
  onOpenFolder: () => void;
  /** Hands a drafted prompt to the editor's AI Assistant. */
  onAskAI?: (prompt: string) => void;
  /** Returns a reason to refuse an action that rewrites files (switching branches, pulling), or null to allow it. */
  workingTreeGuard?: (action: string) => string | null;
  /** Called after Git rewrote the working tree (branch switch, pull), so the app can refresh files and the index. */
  onWorkingTreeChanged?: () => void;
  /** Show the commit history of this file (path relative to the opened folder). */
  historyRequest?: { path: string; id: number } | null;
  onHistoryHandled?: () => void;
}

const diffScopes: Record<ChangeGroup, DiffScope> = { staged: "staged", changes: "working tree", conflicts: "merge conflict" };

const groupNames: Record<ChangeGroup, string> = { conflicts: "Merge Changes", staged: "Staged Changes", changes: "Changes" };
const changeNames: Record<string, string> = { M: "Modified", A: "Added", D: "Deleted", R: "Renamed", C: "Copied", "?": "Untracked", U: "Conflict" };
function fileName(path: string) { return path.split("/").pop() ?? path; }
function changeCode(change: GitChange, group: ChangeGroup) { return group === "conflicts" ? "U" : group === "staged" ? change.index_status : change.index_status === "?" ? "?" : change.worktree_status; }
function shortDate(date: string) { return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }

const commitStatusNames: Record<string, string> = { A: "Added", M: "Modified", D: "Deleted", R: "Renamed", C: "Copied", T: "Type changed" };
function subjectOf(message: string) { return message.split("\n", 1)[0]; }
function bodyOf(message: string) { return message.split("\n").slice(1).join("\n").trim(); }

export function EditorGitPage({ repository, active, onReturn, onOpenFolder, onAskAI, workingTreeGuard, onWorkingTreeChanged, historyRequest, onHistoryHandled }: Props) {
  const review = useGitReview(repository?.id ?? null, active);
  const [expanded, setExpanded] = useState<Record<ChangeGroup, boolean>>({ conflicts: true, staged: true, changes: true });
  const [layout, setLayout] = useState<"split" | "unified">("split");
  const [commitSha, setCommitSha] = useState<string | null>(null);
  const [historyPath, setHistoryPath] = useState<string | null>(null);
  const [history, setHistory] = useState<{ path: string; data: FileHistory | null; error: string | null } | null>(null);
  const historyData = history?.path === historyPath ? history : null;
  const commitView = useCommitDetails(repository?.id ?? null, commitSha, historyData?.data?.path ?? null);

  useEffect(() => {
    if (!historyRequest) return;
    review.select(null);
    setCommitSha(null);
    setHistoryPath(historyRequest.path);
    onHistoryHandled?.();
    // review.select is a new closure each render; only a new request should run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyRequest]);

  useEffect(() => {
    if (!historyPath || !repository) return;
    let current = true;
    setHistory({ path: historyPath, data: null, error: null });
    gitApi.getFileHistory(repository.id, historyPath)
      .then(data => { if (current) setHistory({ path: historyPath, data, error: null }); })
      .catch(reason => { if (current) setHistory({ path: historyPath, data: null, error: reason instanceof Error ? reason.message : "Could not read this file's history." }); });
    return () => { current = false; };
  }, [historyPath, repository]);
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [drafting, setDrafting] = useState<"message" | "review" | null>(null);
  const { settings } = useAppSettings();
  const confirm = useConfirm();
  const status = review.status;
  const lines = useMemo(() => parseGitDiff(review.patch?.content ?? ""), [review.patch]);
  const { added, removed } = diffCounts(lines);
  const commitLines = useMemo(() => parseGitDiff(commitView.patch?.content ?? ""), [commitView.patch]);
  const commitCounts = diffCounts(commitLines);
  const openChange = (path: string, group: ChangeGroup) => { setCommitSha(null); setHistoryPath(null); review.select({ path, group }); };
  const openCommit = (sha: string) => { review.select(null); setCommitSha(sha); };
  const showOverview = () => { setCommitSha(null); setHistoryPath(null); review.select(null); };
  const groups = (Object.keys(groupNames) as ChangeGroup[]).map(group => ({ group, changes: groupChanges(status?.changes ?? [], group) }));
  const branch = status?.branch ?? (status?.head_commit ? "Detached HEAD" : "No commits yet");
  const stagedCount = groups.find(item => item.group === "staged")?.changes.length ?? 0;
  const canCommit = Boolean(repository) && !review.busy && stagedCount > 0 && message.trim().length > 0;

  const commit = async () => {
    if (!canCommit) return;
    const result = await review.commit(message.trim());
    if (result) {
      setMessage("");
      setNotice(null);
      toast.success(`Committed ${result.head_commit?.slice(0, 7) ?? ""}`.trim());
    }
  };

  const discard = async (changes: GitChange[]) => {
    if (!changes.length || review.busy) return;
    const untracked = changes.filter(change => change.index_status === "?").length;
    const single = changes.length === 1 ? changes[0] : null;
    const confirmed = await confirm(single
      ? {
        title: single.index_status === "?" ? `Delete ${fileName(single.path)}?` : `Discard changes in ${fileName(single.path)}?`,
        description: single.index_status === "?" ? `${single.path} is untracked, so it will be deleted from disk. This cannot be undone.` : `Unstaged edits to ${single.path} will be lost. This cannot be undone.`,
        confirmLabel: single.index_status === "?" ? "Delete file" : "Discard changes",
        destructive: true,
      }
      : {
        title: `Discard ${changes.length} changes?`,
        description: `Unstaged edits will be lost${untracked ? ` and ${untracked} untracked ${untracked === 1 ? "file" : "files"} will be deleted` : ""}. Staged changes are kept. This cannot be undone.`,
        confirmLabel: "Discard all",
        destructive: true,
      });
    if (!confirmed) return;
    const paths = changes.map(change => change.path);
    const result = await review.discard(paths);
    if (result) announceFilesChanged(paths);
  };

  const changeBranch = async (name: string, create: boolean): Promise<boolean> => {
    const blocked = workingTreeGuard?.("switching branches");
    if (blocked) { setNotice(blocked); return false; }
    setNotice(null);
    const result = await (create ? review.createBranch(name) : review.switchBranch(name));
    if (!result) return false;
    setCommitSha(null);
    announceFilesChanged(["*"]);
    onWorkingTreeChanged?.();
    toast.success(create ? `Created and switched to ${name}` : `Switched to ${name}`);
    return true;
  };

  const sync = async (action: "fetch" | "pull" | "push") => {
    if (!status || review.busy) return;
    if (action === "pull") {
      const blocked = workingTreeGuard?.("pulling");
      if (blocked) { setNotice(blocked); return; }
    }
    setNotice(null);
    const result = await review[action]();
    if (!result) return;
    if (action === "pull") {
      announceFilesChanged(["*"]);
      onWorkingTreeChanged?.();
    }
    toast.success(action === "fetch"
      ? `Fetched${result.behind ? `: ${result.behind} new ${result.behind === 1 ? "commit" : "commits"} to pull` : ""}`
      : action === "pull" ? `Pulled from ${result.upstream ?? "the upstream"}` : `Pushed to ${result.upstream ?? "the remote"}`);
  };

  const generateMessage = async () => {
    if (!repository || !status || drafting || !stagedCount) return;
    setDrafting("message");
    setNotice(null);
    try {
      const staged = await gitApi.getStagedDiff(repository.id);
      if (!staged.files) { setNotice("Nothing is staged. Stage changes before generating a message."); return; }
      const reply = await runAgent({
        provider: settings.defaultProvider,
        prompt: commitMessagePrompt(staged.stat, staged.content, status.commits.map(commit => commit.message), staged.truncated),
        workingDirectory: repository.root_path,
        repositoryId: repository.id,
      });
      const cleaned = cleanCommitMessage(reply);
      if (!cleaned) { setNotice(`${PROVIDER_NAMES[settings.defaultProvider]} returned an empty message. Try again or write one yourself.`); return; }
      setMessage(cleaned);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not generate a commit message.");
    } finally {
      setDrafting(null);
    }
  };

  const reviewStaged = async () => {
    if (!repository || !onAskAI || drafting) return;
    setDrafting("review");
    setNotice(null);
    try {
      const staged = await gitApi.getStagedDiff(repository.id);
      if (!staged.files) { setNotice("Nothing is staged to review."); return; }
      onAskAI(stagedReviewPrompt(staged.stat, staged.content, staged.truncated));
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not read the staged changes.");
    } finally {
      setDrafting(null);
    }
  };

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
        {repository && <div className="editor-git-project"><GitBranch size={17} /><div><strong>{repository.name}</strong>{status ? <BranchPicker repositoryId={repository.id} label={branch} current={status.branch} disabled={review.busy} onSwitch={name => changeBranch(name, false)} onCreate={name => changeBranch(name, true)} /> : <span>{review.loading ? "Reading Git repository…" : "Git unavailable"}</span>}</div><span className="editor-git-count">{status?.changes.length ?? "—"}</span></div>}
        {repository && status && <form className="editor-git-commit-box" onSubmit={event => { event.preventDefault(); void commit(); }}>
          <div className="editor-git-commit-input">
            <textarea aria-label="Commit message" rows={2} value={message} disabled={review.busy || drafting === "message"} placeholder={drafting === "message" ? "Writing a commit message…" : stagedCount ? "Message (Ctrl/Cmd+Enter to commit)" : "Stage changes to commit"} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void commit(); } }} />
            <button type="button" className="editor-git-generate" aria-label="Generate commit message with AI"
              title={stagedCount ? `Write a message for the staged changes with ${PROVIDER_NAMES[settings.defaultProvider]}` : "Stage changes first"}
              disabled={!stagedCount || review.busy || drafting !== null} onClick={() => void generateMessage()}>
              {drafting === "message" ? <LoaderCircle size={13} className="editor-git-spin" /> : <Sparkles size={13} />}
            </button>
          </div>
          <button type="submit" className="editor-git-primary editor-git-commit-button" disabled={!canCommit} title={stagedCount ? "Commit staged changes" : "Stage changes first"}>{review.busy ? <LoaderCircle size={13} className="editor-git-spin" /> : <Check size={13} />}<span>Commit{stagedCount ? ` (${stagedCount})` : ""}</span></button>
        </form>}
        {repository && status && <div className="editor-git-sync" role="group" aria-label="Sync with remote">
          <span className="editor-git-sync-upstream" title={status.upstream ? `Upstream: ${status.upstream}` : "This branch is not published yet"}>{status.upstream ?? (status.branch ? "Not published" : "Detached HEAD")}</span>
          <button type="button" aria-label="Fetch from remotes" title="Fetch from remotes" disabled={review.busy} onClick={() => void sync("fetch")}><RefreshCcw size={13} /></button>
          <button type="button" aria-label={`Pull${status.behind ? ` ${status.behind} ${status.behind === 1 ? "commit" : "commits"}` : ""}`} title="Pull (fast-forward only)" disabled={review.busy || !status.upstream} onClick={() => void sync("pull")}><ArrowDownToLine size={13} /><span>{status.behind ?? 0}</span></button>
          <button type="button" aria-label={status.upstream ? `Push${status.ahead ? ` ${status.ahead} ${status.ahead === 1 ? "commit" : "commits"}` : ""}` : "Publish branch"} title={status.upstream ? `Push to ${status.upstream}` : "Publish this branch to the remote"} disabled={review.busy || !status.branch || !status.head_commit} onClick={() => void sync("push")}><ArrowUpFromLine size={13} /><span>{status.upstream ? status.ahead ?? 0 : "Publish"}</span></button>
        </div>}
        <button type="button" className={`editor-git-overview-link ${!review.selection && !commitSha && !historyPath ? "is-selected" : ""}`} onClick={showOverview}><History size={15} /><span>Repository overview</span></button>
        <div className="editor-git-change-list">
          {groups.map(({ group, changes }) => changes.length > 0 && <div className="editor-git-change-group" key={group}>
            <div className="editor-git-group">
              <button type="button" className="editor-git-group-heading" aria-expanded={expanded[group]} onClick={() => setExpanded(value => ({ ...value, [group]: !value[group] }))}>{expanded[group] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<span>{groupNames[group]}</span><span className="editor-git-count">{changes.length}</span></button>
              {group === "staged" && onAskAI && <button type="button" className="editor-git-group-action" aria-label="Review staged changes with AI" title="Draft an AI review of everything staged" disabled={drafting !== null} onClick={() => void reviewStaged()}>{drafting === "review" ? <LoaderCircle size={13} className="editor-git-spin" /> : <Sparkles size={13} />}</button>}
              {group === "staged"
                ? <button type="button" className="editor-git-group-action" aria-label="Unstage all changes" title="Unstage all" disabled={review.busy} onClick={() => void review.unstage(changes.map(change => change.path))}><Minus size={13} /></button>
                : <>{group === "changes" && <button type="button" className="editor-git-group-action" aria-label="Discard all changes" title="Discard all unstaged changes" disabled={review.busy} onClick={() => void discard(changes)}><Undo2 size={13} /></button>}<button type="button" className="editor-git-group-action" aria-label={group === "conflicts" ? "Stage all resolved conflicts" : "Stage all changes"} title={group === "conflicts" ? "Mark all as resolved" : "Stage all"} disabled={review.busy} onClick={() => void review.stage(changes.map(change => change.path))}><Plus size={13} /></button></>}
            </div>
            {expanded[group] && changes.map(change => {
              const code = changeCode(change, group);
              const selected = review.selection?.path === change.path && review.selection.group === group;
              return <div className={`editor-git-change-row ${selected ? "is-selected" : ""}`} key={change.path}>
                <button type="button" className={`editor-git-change ${selected ? "is-selected" : ""}`} aria-label={`${groupNames[group]}: ${change.path}`} aria-pressed={selected} title={`${change.path}${change.original_path ? ` (from ${change.original_path})` : ""}`} onClick={() => openChange(change.path, group)}>
                  <FileCode2 size={14} /><span className="editor-git-change-path"><span>{fileName(change.path)}</span><small>{change.path.includes("/") ? change.path.slice(0, change.path.lastIndexOf("/")) : ""}</small></span><span className={`editor-git-change-code code-${code === "?" ? "untracked" : code}`} title={changeNames[code] ?? code}>{code}</span>
                </button>
                {group === "staged"
                  ? <button type="button" className="editor-git-change-action" aria-label={`Unstage ${change.path}`} title="Unstage" disabled={review.busy} onClick={() => void review.unstage([change.path])}><Minus size={13} /></button>
                  : <>{group === "changes" && <button type="button" className="editor-git-change-action" aria-label={`Discard ${change.path}`} title={change.index_status === "?" ? "Delete untracked file" : "Discard changes"} disabled={review.busy} onClick={() => void discard([change])}><Undo2 size={13} /></button>}<button type="button" className="editor-git-change-action" aria-label={`Stage ${change.path}`} title={group === "conflicts" ? "Mark as resolved" : "Stage"} disabled={review.busy} onClick={() => void review.stage([change.path])}><Plus size={13} /></button></>}
              </div>;
            })}
          </div>)}
          {status && !status.changes.length && <div className="editor-git-sidebar-clean"><CheckCircle2 size={22} /><span>Working tree clean</span></div>}
        </div>
        <div className="editor-git-sidebar-bottom"><GitCommitHorizontal size={14} /><span>{status?.head_commit?.slice(0, 7) ?? "No HEAD commit"}</span><span>Git</span></div>
      </aside>

      <div className="editor-git-main">
        <header className="editor-git-header"><div className="editor-git-tab"><GitBranch size={15} /><span>{review.selection ? fileName(review.selection.path) : commitSha ? `Commit ${commitSha.slice(0, 7)}` : historyPath ? `History · ${fileName(historyPath)}` : "Git Repository"}</span></div><div className="editor-git-header-actions">{status?.remote_url && <button type="button" title={status.remote_url} onClick={() => void openRemote()}><ExternalLink size={14} /><span>Open remote</span></button>}<button type="button" onClick={onReturn}><ArrowLeft size={14} /><span>Back to code</span></button></div></header>
        {review.error && <div className="editor-git-error" role="alert"><TriangleAlert size={15} /><span>{review.error}</span><button type="button" onClick={review.refresh}>Retry</button></div>}
        {review.actionError && <div className="editor-git-error" role="alert"><TriangleAlert size={15} /><span>{review.actionError}</span><button type="button" onClick={review.clearActionError}>Dismiss</button></div>}
        {notice && <div className="editor-git-error" role="alert">{notice}</div>}
        {!repository ? <div className="editor-git-empty"><GitBranch size={50} /><h1>Open a project to review Git</h1><p>Choose a local folder to see its repository and changes.</p><button type="button" className="editor-git-primary" onClick={onOpenFolder}>Open Folder</button></div>
          : !status ? <div className="editor-git-empty">{review.loading ? <><LoaderCircle className="editor-git-spin" size={28} /><p>Reading repository status…</p></> : <><GitBranch size={42} /><h1>Git is unavailable for this folder</h1><p>Open a folder inside a Git repository to review changes.</p><button type="button" className="editor-git-primary" onClick={onOpenFolder}>Open Folder</button></>}</div>
          : commitSha ? <div className="editor-git-commit-view">
            {commitView.error ? <div className="editor-git-empty" role="alert"><TriangleAlert size={26} /><p>{commitView.error}</p><button type="button" className="editor-git-primary" onClick={showOverview}>Back to overview</button></div>
              : !commitView.details ? <div className="editor-git-empty"><LoaderCircle className="editor-git-spin" size={24} /><p>Loading commit…</p></div>
              : <>
                <div className="editor-git-diff-toolbar">
                  <div>{historyPath && <button type="button" className="editor-git-back-link" onClick={() => setCommitSha(null)}><ArrowLeft size={13} /><span>History</span></button>}<span title={commitView.details.message}>{subjectOf(commitView.details.message)}</span><small>{commitView.details.files.length} {commitView.details.files.length === 1 ? "file" : "files"} changed</small></div>
                  <div className="editor-git-diff-controls">
                    <button type="button" className="editor-git-commit-hash" aria-label={`Copy commit ${commitView.details.sha.slice(0, 7)}`} title={commitView.details.sha} onClick={() => void copyCommit(commitView.details!.sha)}><code>{commitView.details.sha.slice(0, 7)}</code>{copied === commitView.details.sha ? <Check size={13} /> : <Copy size={13} />}</button>
                    <button type="button" aria-label="Split diff" aria-pressed={layout === "split"} title="Side by side diff" onClick={() => setLayout("split")}><Columns2 size={15} /></button>
                    <button type="button" aria-label="Unified diff" aria-pressed={layout === "unified"} title="Unified diff" onClick={() => setLayout("unified")}><List size={15} /></button>
                  </div>
                </div>
                <div className="editor-git-commit-meta">
                  <span title={commitView.details.author_email}>{commitView.details.author}</span>
                  <time dateTime={commitView.details.committed_at}>{new Date(commitView.details.committed_at).toLocaleString()}</time>
                  <span>{commitView.details.parents.length === 0 ? "Root commit" : commitView.details.parents.length > 1 ? `Merge of ${commitView.details.parents.map(parent => parent.slice(0, 7)).join(" + ")} (compared with the first parent)` : `Parent ${commitView.details.parents[0].slice(0, 7)}`}</span>
                </div>
                {bodyOf(commitView.details.message) && <pre className="editor-git-commit-body">{bodyOf(commitView.details.message)}</pre>}
                <ul className="editor-git-commit-files" aria-label="Files changed in this commit">
                  {commitView.details.files.map(file => <li key={file.path}>
                    <button type="button" aria-pressed={commitView.file === file.path} aria-label={`${commitStatusNames[file.status] ?? file.status}: ${file.path}`} className={commitView.file === file.path ? "is-selected" : undefined} onClick={() => commitView.selectFile(file.path)}>
                      <span className={`editor-git-change-code code-${file.status === "A" ? "A" : file.status === "D" ? "D" : file.status === "R" ? "R" : "M"}`} title={commitStatusNames[file.status] ?? file.status}>{file.status}</span>
                      <span className="editor-git-commit-file-path">{file.path}{file.original_path && <small> ← {file.original_path}</small>}</span>
                      <span className="editor-git-diff-stats">{file.additions === null ? <small>binary</small> : <><b>+{file.additions}</b><b>−{file.deletions}</b></>}</span>
                    </button>
                  </li>)}
                </ul>
                {!commitView.file ? <div className="editor-git-empty"><p>This commit changes no files.</p></div>
                  : commitView.diffLoading ? <div className="editor-git-empty"><LoaderCircle className="editor-git-spin" size={24} /><p>Loading diff…</p></div>
                  : commitView.diffError ? <div className="editor-git-empty" role="alert"><TriangleAlert size={26} /><p>{commitView.diffError}</p></div>
                  : commitView.patch?.is_binary ? <div className="editor-git-empty"><FileCode2 size={35} /><h2>Binary file</h2><p>A text diff is unavailable for this file.</p></div>
                  : !commitLines.length ? <div className="editor-git-empty"><p>No text changes in this file.</p></div>
                  : <>
                    <div className="editor-git-commit-diff-bar"><span title={commitView.file}>{commitView.file}</span><span className="editor-git-diff-stats"><b>+{commitCounts.added}</b><b>−{commitCounts.removed}</b></span>{onAskAI && <button type="button" className="editor-git-ai-review" title="Draft an AI review of this file in the commit" onClick={() => { if (commitView.patch && commitView.file && commitView.details) onAskAI(diffReviewPrompt(commitView.file, `commit ${commitView.details.sha.slice(0, 7)}`, commitView.patch.content)); }}><Sparkles size={14} /><span>Review with AI</span></button>}</div>
                    <DiffView key={`${commitView.details.sha}:${commitView.file}`} lines={commitLines} layout={layout} labels={commitView.details.parents.length ? ["Parent", "Commit"] : ["Empty", "Commit"]} truncated={commitView.patch?.truncated} />
                  </>}
              </>}
          </div>
          : review.selection ? <>
            <div className="editor-git-diff-toolbar"><div><span title={review.selection.path}>{review.selection.path}</span><small>{review.selection.group === "staged" ? "HEAD → Index" : review.selection.group === "conflicts" ? "Merge conflict" : "Index → Working tree"}</small></div><div className="editor-git-diff-controls">{review.patch && <span className="editor-git-diff-stats"><b>+{added}</b><b>−{removed}</b></span>}{onAskAI && <button type="button" className="editor-git-ai-review" title="Draft an AI review of this diff" disabled={!review.patch || review.patch.is_binary || !lines.length} onClick={() => { if (review.patch && review.selection) onAskAI(diffReviewPrompt(review.selection.path, diffScopes[review.selection.group], review.patch.content)); }}><Sparkles size={14} /><span>Review with AI</span></button>}<button type="button" aria-label="Split diff" aria-pressed={layout === "split" && review.selection.group !== "conflicts"} title={review.selection.group === "conflicts" ? "Merge conflicts use a unified diff" : "Side by side diff"} disabled={review.selection.group === "conflicts"} onClick={() => setLayout("split")}><Columns2 size={15} /></button><button type="button" aria-label="Unified diff" aria-pressed={layout === "unified" || review.selection.group === "conflicts"} title="Unified diff" onClick={() => setLayout("unified")}><List size={15} /></button></div></div>
            {review.diffLoading ? <div className="editor-git-empty"><LoaderCircle className="editor-git-spin" size={24} /><p>Loading diff…</p></div> : review.diffError ? <div className="editor-git-empty" role="alert"><TriangleAlert size={26} /><p>{review.diffError}</p><button type="button" className="editor-git-primary" onClick={review.refresh}>Retry diff</button></div> : review.patch?.is_binary ? <div className="editor-git-empty"><FileCode2 size={35} /><h2>Binary file</h2><p>A text diff is unavailable for this file.</p></div> : !lines.length ? <div className="editor-git-empty"><CheckCircle2 size={28} /><p>No text changes in this diff.</p><button type="button" onClick={review.refresh}>Refresh Git status</button></div> : <DiffView key={`${review.selection.group}:${review.selection.path}`} lines={lines} layout={review.selection.group === "conflicts" ? "unified" : layout} labels={review.selection.group === "staged" ? ["HEAD", "Index"] : ["Index", "Working tree"]} truncated={review.patch?.truncated} />}
          </> : historyPath ? <div className="editor-git-overview" aria-label={`History of ${historyPath}`} role="region">
            <div className="editor-git-history-heading"><div><History size={16} /><h2>History of {historyData?.data?.path ?? historyPath}</h2></div><span>{historyData?.data ? `${historyData.data.commits.length} ${historyData.data.commits.length === 1 ? "commit" : "commits"}${historyData.data.commits.length === 50 ? " (latest 50)" : ""}` : ""}</span></div>
            {historyData?.error ? <div className="editor-git-empty" role="alert"><TriangleAlert size={26} /><p>{historyData.error}</p></div>
              : !historyData?.data ? <div className="editor-git-empty"><LoaderCircle className="editor-git-spin" size={24} /><p>Reading history…</p></div>
              : !historyData.data.commits.length ? <div className="editor-git-no-history"><GitCommitHorizontal size={25} /><p>No commits have changed this file yet.</p></div>
              : <ol className="editor-git-history">{historyData.data.commits.map(commit => <li key={commit.sha}><span className="editor-git-history-dot"><GitCommitHorizontal size={17} /></span><button type="button" className="editor-git-history-open" aria-label={`Open commit ${commit.sha.slice(0, 7)}: ${commit.message}`} onClick={() => openCommit(commit.sha)}><strong>{commit.message}</strong><span>{commit.author}<span>·</span><time dateTime={commit.committed_at} title={new Date(commit.committed_at).toLocaleString()}>{formatRelativeTime(commit.committed_at)}</time></span></button><button type="button" className="editor-git-commit-hash" aria-label={`Copy commit ${commit.sha.slice(0, 7)}`} title={commit.sha} onClick={() => void copyCommit(commit.sha)}><code>{commit.sha.slice(0, 7)}</code>{copied === commit.sha ? <Check size={13} /> : <Copy size={13} />}</button></li>)}</ol>}
          </div> : <div className="editor-git-overview">
            <div className="editor-git-hero"><div className="editor-git-hero-mark"><GitBranch size={25} /></div><div><p>REPOSITORY</p><h1>{status.remote_url?.split("/").pop() ?? repository.name}</h1><span title={repository.root_path}>{repository.root_path}</span></div><span className="editor-git-branch"><GitBranch size={13} />{branch}</span></div>
            <div className="editor-git-metrics"><div><span>Working tree</span><strong>{status.changes.length ? `${status.changes.length} changed ${status.changes.length === 1 ? "file" : "files"}` : "Working tree clean"}</strong><small>{groupChanges(status.changes, "staged").length} staged · {groupChanges(status.changes, "changes").length} unstaged{groupChanges(status.changes, "conflicts").length ? ` · ${groupChanges(status.changes, "conflicts").length} conflicts` : ""}</small></div><div><span>Upstream</span><strong>{status.upstream ?? "No upstream configured"}</strong><small><ArrowUp size={12} />{status.ahead ?? "—"} ahead <ArrowDown size={12} />{status.behind ?? "—"} behind</small></div><div><span>Latest commit</span><strong className="editor-git-mono">{status.head_commit?.slice(0, 7) ?? "No commits yet"}</strong><small>{status.commits[0]?.message ?? "Stage changes and commit from the sidebar."}</small></div></div>
            <div className="editor-git-history-heading"><div><History size={16} /><h2>Commit history</h2></div><span>{status.commits.length ? `Latest ${status.commits.length} commits` : ""}</span></div>
            {status.commits.length ? <ol className="editor-git-history">{status.commits.map(commit => <li key={commit.sha}><span className="editor-git-history-dot"><GitCommitHorizontal size={17} /></span><button type="button" className="editor-git-history-open" aria-label={`Open commit ${commit.sha.slice(0, 7)}: ${commit.message}`} onClick={() => openCommit(commit.sha)}><strong>{commit.message}</strong><span>{commit.author}<span>·</span><time dateTime={commit.committed_at} title={new Date(commit.committed_at).toLocaleString()}>{shortDate(commit.committed_at)}</time></span></button><button type="button" className="editor-git-commit-hash" aria-label={`Copy commit ${commit.sha.slice(0, 7)}`} title={commit.sha} onClick={() => void copyCommit(commit.sha)}><code>{commit.sha.slice(0, 7)}</code>{copied === commit.sha ? <Check size={13} /> : <Copy size={13} />}</button></li>)}</ol> : <div className="editor-git-no-history"><GitCommitHorizontal size={25} /><p>No commits in this repository yet.</p></div>}
          </div>}
        <footer className="editor-git-status"><span><GitBranch size={12} />{status ? branch : "Git Repository"}</span><span>{review.loading ? "Refreshing…" : review.selection ? groupNames[review.selection.group] : commitSha ? "Commit details" : "Select a changed file or a commit to see its diff"}</span></footer>
      </div>
    </div>
  </section>;
}

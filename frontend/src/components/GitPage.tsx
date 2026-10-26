import { useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowDown, ArrowUp, Calendar, Check, Code2, Copy, ExternalLink, FileBox, Files, FolderGit2,
  GitBranch, GitCommitHorizontal, History, LoaderCircle, RefreshCw, TriangleAlert,
} from "lucide-react";
import type { RepositoryInfo } from "../types/domain";
import { useGitStatus } from "../hooks/useGitStatus";
import { groupChanges } from "../editor/useGitReview";
import { copyText } from "../lib/clipboard";
import { openExternal } from "../lib/openExternal";
import { formatRelativeTime } from "../lib/time";

interface Props {
  repository: RepositoryInfo | null;
  onNavigate: (tab: string) => void;
}

type IconType = ComponentType<{ size?: number; className?: string }>;

const buttonClass = "inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass = "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function Card({ title, icon: Icon, aside, children }: { title: string; icon: IconType; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-card-foreground">
      <header className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold"><Icon size={16} className="text-muted-foreground" />{title}</h3>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

function Row({ icon: Icon, label, children }: { icon: IconType; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/40 px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon size={15} />{label}</span>
      <span className="min-w-0 truncate text-right text-sm text-foreground">{children}</span>
    </div>
  );
}

export function GitPage({ repository, onNavigate }: Props) {
  const git = useGitStatus(repository?.id ?? null);
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const status = git.status;
  const branch = status?.branch ?? repository?.current_branch ?? null;
  const headCommit = status?.head_commit ?? repository?.head_commit ?? null;
  const staged = status ? groupChanges(status.changes, "staged").length : 0;
  const unstaged = status ? groupChanges(status.changes, "changes").length : 0;
  const conflicts = status ? groupChanges(status.changes, "conflicts").length : 0;

  const copy = async (sha: string) => {
    try {
      await copyText(sha);
      setCopied(sha);
      setNotice(null);
    } catch {
      setNotice("Could not copy the commit hash.");
    }
  };

  const openRemote = async () => {
    if (!status?.remote_url) return;
    try {
      await openExternal(status.remote_url);
    } catch {
      setNotice("Could not open the remote repository.");
    }
  };

  if (!repository) {
    return (
      <div className="flex w-full flex-1 items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center gap-5 rounded-2xl border border-border bg-card p-10 text-center">
          <FolderGit2 size={56} className="text-emerald-500" />
          <div>
            <h2 className="text-xl font-semibold">No Repository Connected</h2>
            <p className="mt-2 text-sm text-muted-foreground">Open a local project to see its branch, working tree, and commit history.</p>
          </div>
          <button type="button" className={primaryButtonClass} onClick={() => onNavigate("explorer")}>Connect Repository</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 p-5 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-500"><GitBranch size={26} /></div>
          <div>
            <h1 className="text-2xl font-semibold">Git Repository</h1>
            <p className="text-sm text-muted-foreground">Live status, branch, and recent commits for {repository.name}.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={buttonClass} aria-label="Refresh Git status" title="Refresh Git status" disabled={git.loading} onClick={git.refresh}>
            <RefreshCw size={15} className={git.loading ? "animate-spin" : undefined} /><span>Refresh</span>
          </button>
          {status?.remote_url && (
            <button type="button" className={buttonClass} title={status.remote_url} onClick={() => void openRemote()}>
              <ExternalLink size={15} /><span>Open remote</span>
            </button>
          )}
          <button type="button" className={primaryButtonClass} onClick={() => onNavigate("editor")}>
            <Code2 size={15} /><span>Open in editor</span>
          </button>
        </div>
      </header>

      {git.error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <TriangleAlert size={16} /><span className="flex-1">{git.error}</span>
          <button type="button" className={buttonClass} onClick={git.refresh}>Retry</button>
        </div>
      )}
      {notice && <div role="alert" className="rounded-xl border border-destructive/30 px-4 py-3 text-sm text-destructive">{notice}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Repository Details" icon={FolderGit2}>
          <div className="flex flex-col gap-2">
            <Row icon={FolderGit2} label="Name"><span className="font-mono">{repository.name}</span></Row>
            <Row icon={FileBox} label="Root Path"><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{repository.root_path}</code></Row>
            <Row icon={Calendar} label="Opened At">{repository.opened_at ? new Date(repository.opened_at).toLocaleString() : "—"}</Row>
            <Row icon={Files} label="File Count"><span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{repository.file_count}</span></Row>
          </div>
        </Card>

        <Card title="Branch & Commit" icon={GitBranch} aside={!status && git.loading ? "Reading Git status…" : undefined}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current branch</span>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <GitBranch size={14} />{branch ?? (headCommit ? "Detached HEAD" : "No commits yet")}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">HEAD commit</span>
              {headCommit ? (
                <button type="button" className={buttonClass} aria-label="Copy HEAD commit" title={headCommit} onClick={() => void copy(headCommit)}>
                  <code className="font-mono text-xs">{headCommit.slice(0, 7)}</code>
                  {copied === headCommit ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              ) : <span className="text-sm text-muted-foreground">No commits yet</span>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upstream</span>
              <p className="mt-1 truncate text-sm font-medium" title={status?.upstream ?? undefined}>{status ? (status.upstream ?? "No upstream configured") : "—"}</p>
              <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><ArrowUp size={12} />{status?.ahead ?? "—"} ahead</span>
                <span className="inline-flex items-center gap-1"><ArrowDown size={12} />{status?.behind ?? "—"} behind</span>
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Working tree</span>
              <p className="mt-1 text-sm font-medium">
                {!status ? "—" : status.changes.length === 0 ? "Working tree clean" : `${status.changes.length} changed ${status.changes.length === 1 ? "file" : "files"}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {status ? `${staged} staged · ${unstaged} unstaged${conflicts ? ` · ${conflicts} conflicts` : ""}` : "Git status unavailable"}
              </p>
            </div>
          </div>
          {status && status.changes.length > 0 && (
            <button type="button" className={`${buttonClass} w-fit`} onClick={() => onNavigate("editor")}>Review changes in editor</button>
          )}
        </Card>
      </div>

      <Card title="Git Activity" icon={History} aside={status?.commits.length ? `Latest ${status.commits.length} commits` : undefined}>
        {!status ? (
          <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            {git.loading ? <><LoaderCircle size={16} className="animate-spin" />Reading Git history…</> : "Git history is unavailable for this folder."}
          </div>
        ) : status.commits.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No commits in this repository yet.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-border/70">
            {status.commits.map(commit => (
              <li key={commit.sha} className="flex items-center gap-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><GitCommitHorizontal size={17} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={commit.message}>{commit.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {commit.author}
                    <span className="mx-1.5">·</span>
                    <time dateTime={commit.committed_at} title={new Date(commit.committed_at).toLocaleString()}>{formatRelativeTime(commit.committed_at)}</time>
                  </p>
                </div>
                <button type="button" className={buttonClass} aria-label={`Copy commit ${commit.sha.slice(0, 7)}`} title={commit.sha} onClick={() => void copy(commit.sha)}>
                  <code className="font-mono text-xs">{commit.sha.slice(0, 7)}</code>
                  {copied === commit.sha ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  Activity, ArrowRight, BarChart3, Bot, Code2, Database, FileCode2, Files, Folder, GitBranch,
  GitCommitHorizontal, LoaderCircle, RefreshCw, Server, SquareTerminal, Sparkles, TriangleAlert,
} from "lucide-react";
import type { RepositoryInfo, TreeNode } from "../types/domain";
import { healthApi } from "../api/healthApi";
import { useGitStatus } from "../hooks/useGitStatus";
import { groupChanges } from "../editor/useGitReview";
import { describeProvider, getProviderStatuses, PROVIDER_NAMES, type ProviderId, type ProviderStatus } from "../lib/providers";
import { formatRelativeTime } from "../lib/time";

interface Props {
  repository: RepositoryInfo | null;
  tree: TreeNode | null;
  isLoading: boolean;
  onNavigate: (tab: string) => void;
  onReindex?: () => Promise<void> | void;
}

type IconType = ComponentType<{ size?: number; className?: string }>;

// ── helpers ──────────────────────────────────────────────────────────────────
function countFiles(node: TreeNode | null): { total: number; byLang: Record<string, number> } {
  const byLang: Record<string, number> = {};
  let total = 0;
  function walk(n: TreeNode) {
    if (!n.is_directory) {
      total++;
      if (n.language) byLang[n.language] = (byLang[n.language] ?? 0) + 1;
    }
    n.children.forEach(walk);
  }
  if (node) walk(node);
  return { total, byLang };
}

const LANG_COLORS: Record<string, string> = {
  python: "#3b82f6", typescript: "#a78bfa", javascript: "#fbbf24",
  tsx: "#f472b6", jsx: "#fb923c", rust: "#f97316", go: "#34d399",
  json: "#94a3b8", yaml: "#64748b", css: "#38bdf8", html: "#fb923c",
  markdown: "#a3e635", shell: "#4ade80", other: "#475569",
};

const LANG_LABELS: Record<string, string> = {
  python: "Python", typescript: "TypeScript", javascript: "JavaScript",
  tsx: "TSX / React", jsx: "JSX / React", rust: "Rust", go: "Go",
  json: "JSON", yaml: "YAML", css: "CSS", html: "HTML",
  markdown: "Markdown", shell: "Shell", other: "Other",
};

// Every destination here is a real page; nothing promises a feature that does not exist.
const QUICK_ACTIONS: { icon: IconType; label: string; desc: string; tab: string; needsRepository?: boolean }[] = [
  { icon: Code2, label: "Code Editor", desc: "Edit files with tabs, search, and Git", tab: "editor" },
  { icon: Folder, label: "File Explorer", desc: "Browse the indexed tree and symbols", tab: "explorer" },
  { icon: GitBranch, label: "Git Repository", desc: "Branch, upstream, and recent commits", tab: "git", needsRepository: true },
  { icon: SquareTerminal, label: "Terminal", desc: "Shell sessions in the project folder", tab: "terminal", needsRepository: true },
  { icon: Bot, label: "AI Assistant", desc: "Ask Codex or Gemini about this code", tab: "ai" },
  { icon: BarChart3, label: "Analytics", desc: "Language and file size breakdown", tab: "analytics", needsRepository: true },
];

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const cardClass = "rounded-2xl border border-border bg-card p-5 text-card-foreground";
const buttonClass = "inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass = "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function StatusPill({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: ReactNode }) {
  const tones = {
    ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    bad: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    muted: "border-border bg-muted text-muted-foreground",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{children}</span>;
}

function StatusRow({ label, detail, children }: { label: string; detail?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/40 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="truncate text-xs text-muted-foreground" title={detail}>{detail}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function DashboardPage({ repository, tree, isLoading, onNavigate, onReindex }: Props) {
  const { total, byLang } = countFiles(tree);
  const topLangs = Object.entries(byLang).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const [now, setNow] = useState(() => new Date());
  const git = useGitStatus(repository?.id ?? null);
  const [backend, setBackend] = useState<"checking" | "ok" | "down">("checking");
  const [providers, setProviders] = useState<Record<ProviderId, ProviderStatus> | null | "loading">("loading");
  const [reindexing, setReindexing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setBackend("checking");
    healthApi.check().then(() => { if (active) setBackend("ok"); }).catch(() => { if (active) setBackend("down"); });
    return () => { active = false; };
  }, [repository?.id]);

  useEffect(() => {
    let active = true;
    getProviderStatuses().then(result => { if (active) setProviders(result); }).catch(() => { if (active) setProviders(null); });
    return () => { active = false; };
  }, []);

  const reindex = async () => {
    if (!onReindex || reindexing) return;
    setReindexing(true);
    try { await onReindex(); } finally { setReindexing(false); }
  };

  const status = git.status;
  const branch = status?.branch ?? repository?.current_branch ?? null;
  const changes = status?.changes.length ?? null;
  const staged = status ? groupChanges(status.changes, "staged").length : 0;
  const unstaged = status ? groupChanges(status.changes, "changes").length : 0;

  const stats: { icon: IconType; label: string; value: string; sub: string }[] = [
    { icon: Files, label: "Files indexed", value: repository ? repository.file_count.toLocaleString() : "—", sub: repository?.opened_at ? `indexed ${formatRelativeTime(repository.opened_at, now)}` : "open a project to index it" },
    { icon: GitBranch, label: "Branch", value: branch ?? "—", sub: status?.upstream ? `tracking ${status.upstream}` : status ? "no upstream" : "current checkout" },
    { icon: GitCommitHorizontal, label: "Working tree", value: changes === null ? "—" : changes === 0 ? "Clean" : String(changes), sub: status ? (changes ? `${staged} staged · ${unstaged} unstaged` : "nothing to commit") : "changed files" },
    { icon: BarChart3, label: "Languages", value: topLangs.length ? String(Object.keys(byLang).length) : "—", sub: "detected in the index" },
  ];

  return (
    <div className="flex w-full flex-col gap-6 p-5 lg:p-8">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className={`${cardClass} relative overflow-hidden`}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Sparkles size={14} />IFROG</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{greeting(now)}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {repository
                ? <>Working in <strong className="text-foreground">{repository.name}</strong> on <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{branch ?? "no branch"}</code> with {repository.file_count.toLocaleString()} indexed files.</>
                : "Open a local project to browse its files, review Git changes, and ask AI about the code."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="text-right text-sm">
              <p className="font-semibold">{now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</p>
              <p className="text-xs text-muted-foreground">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {repository ? (
                <>
                  <button type="button" className={buttonClass} disabled={isLoading || reindexing || !onReindex} onClick={() => void reindex()} title="Rescan the working tree and rebuild symbols">
                    <RefreshCw size={15} className={reindexing ? "animate-spin" : undefined} />{reindexing ? "Re-indexing…" : "Re-index"}
                  </button>
                  <button type="button" className={primaryButtonClass} onClick={() => onNavigate("editor")}><Code2 size={15} />Open in editor</button>
                </>
              ) : (
                <button type="button" className={primaryButtonClass} disabled={isLoading} onClick={() => onNavigate("explorer")}><Folder size={15} />Open a project</button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className={`${cardClass} flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
              <span className="rounded-lg bg-muted p-2 text-muted-foreground"><Icon size={15} /></span>
            </div>
            <div>
              <p className="truncate font-mono text-2xl font-semibold" title={value}>{value}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick actions + languages ──────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className={cardClass}>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Activity size={15} className="text-muted-foreground" />Quick actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {QUICK_ACTIONS.map(({ icon: Icon, label, desc, tab, needsRepository }) => (
              <button key={tab} type="button" disabled={Boolean(needsRepository) && !repository} onClick={() => onNavigate(tab)}
                className="group flex items-start gap-3 rounded-xl border border-border/70 bg-muted/40 p-4 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
                <span className="rounded-lg bg-background p-2 text-primary"><Icon size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold">{label}<ArrowRight size={13} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" /></span>
                  <span className="mt-1 block text-xs text-muted-foreground">{desc}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={`${cardClass} flex flex-col gap-4`}>
          <h2 className="flex items-center gap-2 text-sm font-semibold"><FileCode2 size={15} className="text-muted-foreground" />Language breakdown</h2>
          {topLangs.length > 0 ? (
            <>
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                {topLangs.map(([lang, count]) => <div key={lang} style={{ flex: count, background: LANG_COLORS[lang] ?? "#475569" }} />)}
              </div>
              <ul className="flex flex-col gap-2.5">
                {topLangs.map(([lang, count]) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <li key={lang} className="flex items-center gap-3 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: LANG_COLORS[lang] ?? "#475569" }} />
                      <span className="flex-1 font-medium">{LANG_LABELS[lang] ?? lang}</span>
                      <span className="font-mono text-xs text-muted-foreground">{count} files</span>
                      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: LANG_COLORS[lang] ?? "#475569" }} /></span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <Database size={28} className="opacity-40" />
              <p>Open a repository to see its language breakdown.</p>
            </div>
          )}
        </section>
      </div>

      {/* ── Recent commits + system status ─────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cardClass}>
          <header className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><GitCommitHorizontal size={15} className="text-muted-foreground" />Recent commits</h2>
            {repository && status && status.commits.length > 0 && <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => onNavigate("git")}>View all</button>}
          </header>
          {!repository ? (
            <p className="py-6 text-sm text-muted-foreground">Open a project to see its commit history.</p>
          ) : git.error ? (
            <div role="alert" className="flex items-center gap-2 py-4 text-sm text-amber-700 dark:text-amber-300"><TriangleAlert size={15} /><span className="flex-1">{git.error}</span><button type="button" className={buttonClass} onClick={git.refresh}>Retry</button></div>
          ) : !status ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><LoaderCircle size={15} className="animate-spin" />Reading Git history…</div>
          ) : status.commits.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No commits in this repository yet.</p>
          ) : (
            <ol className="divide-y divide-border/70">
              {status.commits.slice(0, 6).map(commit => (
                <li key={commit.sha} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><GitCommitHorizontal size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={commit.message}>{commit.message}</p>
                    <p className="text-xs text-muted-foreground">{commit.author} · <time dateTime={commit.committed_at} title={new Date(commit.committed_at).toLocaleString()}>{formatRelativeTime(commit.committed_at, now)}</time></p>
                  </div>
                  <code className="font-mono text-xs text-muted-foreground" title={commit.sha}>{commit.sha.slice(0, 7)}</code>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={`${cardClass} flex flex-col gap-3`}>
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Server size={15} className="text-muted-foreground" />System status</h2>
          <StatusRow label="Backend API" detail={backend === "down" ? "The local service did not answer /health." : "Local FastAPI service"}>
            {backend === "checking" ? <StatusPill tone="muted">Checking…</StatusPill> : backend === "ok" ? <StatusPill tone="ok">Operational</StatusPill> : <StatusPill tone="bad">Unreachable</StatusPill>}
          </StatusRow>
          <StatusRow label="Project index" detail={repository ? `${repository.file_count.toLocaleString()} files${repository.opened_at ? ` · ${formatRelativeTime(repository.opened_at, now)}` : ""}` : "No project open"}>
            {repository ? <StatusPill tone="ok">Indexed</StatusPill> : <StatusPill tone="muted">Idle</StatusPill>}
          </StatusRow>
          <StatusRow label="Git" detail={!repository ? "Open a project to read its repository" : git.error ? git.error : status ? (status.upstream ? `${status.upstream} · ${status.ahead ?? 0} ahead, ${status.behind ?? 0} behind` : "No upstream configured") : "Reading status…"}>
            {!repository ? <StatusPill tone="muted">No project</StatusPill> : git.error ? <StatusPill tone="warn">Unavailable</StatusPill> : status ? <StatusPill tone="ok">{branch ?? "Detached"}</StatusPill> : <StatusPill tone="muted">Checking…</StatusPill>}
          </StatusRow>
          {(["codex", "gemini"] as ProviderId[]).map(id => {
            const described = providers === "loading" ? null : providers === null ? null : describeProvider(providers[id]);
            return (
              <StatusRow key={id} label={`${PROVIDER_NAMES[id]} CLI`} detail="AI provider for the assistant">
                {providers === "loading" ? <StatusPill tone="muted">Checking…</StatusPill> : described ? <StatusPill tone={described.tone}>{described.label}</StatusPill> : <StatusPill tone="muted">Unknown</StatusPill>}
              </StatusRow>
            );
          })}
          <button type="button" className={`${primaryButtonClass} mt-auto justify-center`} onClick={() => onNavigate("ai")}><Bot size={15} />Open AI Assistant</button>
        </section>
      </div>
    </div>
  );
}

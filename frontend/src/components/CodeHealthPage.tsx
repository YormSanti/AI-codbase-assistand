import { useEffect, useMemo, useState } from "react";
import { FileWarning, FolderOpen, KeyRound, ListTodo, LoaderCircle, RefreshCw, Search, ShieldAlert, ShieldCheck, Split, TriangleAlert } from "lucide-react";
import type { HealthCategory, HealthFinding, HealthReport, RepositoryInfo } from "../types/domain";
import { healthApi } from "../api/healthApi";
import { formatRelativeTime } from "../lib/time";

interface Props {
  repository: RepositoryInfo | null;
  onNavigate: (tab: string) => void;
  /** Open a file in the code editor with the cursor on `line`. */
  onOpenInEditor: (path: string, line: number) => void;
}

const CATEGORIES: { id: HealthCategory; label: string; empty: string; icon: typeof KeyRound; tone: string }[] = [
  { id: "secret", label: "Possible secrets", empty: "No hardcoded keys or credentials found.", icon: KeyRound, tone: "text-red-600 dark:text-red-400" },
  { id: "risk", label: "Risky patterns", empty: "No risky calls found.", icon: ShieldAlert, tone: "text-amber-600 dark:text-amber-400" },
  { id: "complexity", label: "Complex functions", empty: "No Python, JavaScript, or TypeScript function has a cyclomatic complexity of 15 or more.", icon: Split, tone: "text-violet-600 dark:text-violet-400" },
  { id: "marker", label: "TODO and FIXME", empty: "No TODO, FIXME, or HACK comments.", icon: ListTodo, tone: "text-sky-600 dark:text-sky-400" },
];

const SEVERITY_STYLES: Record<HealthFinding["severity"], string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  info: "border-border bg-muted text-muted-foreground",
};

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

const buttonClass = "inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";

export function CodeHealthPage({ repository, onNavigate, onOpenInEditor }: Props) {
  const [report, setReport] = useState<{ repositoryId: number; data: HealthReport; at: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<HealthCategory>("secret");
  const [filter, setFilter] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!repository) return;
    let current = true;
    setLoading(true);
    setError(null);
    healthApi.scan(repository.id)
      .then(data => {
        if (!current) return;
        setReport({ repositoryId: repository.id, data, at: new Date().toISOString() });
        // Start on the most important category that has findings.
        setCategory(previous => data.counts[previous] ? previous : (CATEGORIES.find(item => data.counts[item.id])?.id ?? "secret"));
      })
      .catch(reason => { if (current) setError(reason instanceof Error ? reason.message : "The scan failed."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [repository, version]);

  const data = report && report.repositoryId === repository?.id ? report.data : null;
  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return (data?.findings ?? []).filter(finding => finding.category === category
      && (!query || finding.path.toLowerCase().includes(query) || finding.title.toLowerCase().includes(query) || finding.snippet.toLowerCase().includes(query)));
  }, [data, category, filter]);

  if (!repository) {
    return (
      <div className="flex w-full flex-1 items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-10 text-center">
          <ShieldCheck size={48} className="text-emerald-500" />
          <h2 className="text-xl font-semibold">Code Health</h2>
          <p className="text-sm text-muted-foreground">Open a project to scan it for possible secrets, risky code, complex functions, TODO comments, and large files.</p>
          <button type="button" className={buttonClass} onClick={() => onNavigate("explorer")}><FolderOpen size={15} />Open a project</button>
        </div>
      </div>
    );
  }

  const active = CATEGORIES.find(item => item.id === category)!;
  return (
    <div className="flex w-full flex-col gap-6 p-5 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-500"><ShieldCheck size={26} /></div>
          <div>
            <h1 className="text-2xl font-semibold">Code Health</h1>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.files_scanned.toLocaleString()} indexed text files scanned in ${repository.name}${report ? `, ${formatRelativeTime(report.at)}` : ""}.` : `Heuristic checks across the indexed files of ${repository.name}.`}
            </p>
          </div>
        </div>
        <button type="button" className={buttonClass} disabled={loading} onClick={() => setVersion(value => value + 1)}>
          <RefreshCw size={15} className={loading ? "animate-spin" : undefined} />{loading ? "Scanning…" : "Rescan"}
        </button>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 px-4 py-3 text-sm text-destructive">
          <TriangleAlert size={16} /><span className="flex-1">{error}</span>
          <button type="button" className={buttonClass} onClick={() => setVersion(value => value + 1)}>Retry</button>
        </div>
      )}
      {data?.truncated && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          The scan stopped early at its time or result limit. The lists below are partial.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {CATEGORIES.map(item => {
          const Icon = item.icon;
          const count = data?.counts[item.id];
          return (
            <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}
              className={`flex flex-col gap-3 rounded-2xl border bg-card p-5 text-left transition-colors hover:bg-accent ${category === item.id ? "border-ring ring-2 ring-ring/30" : "border-border"}`}>
              <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}<Icon size={16} className={item.tone} /></span>
              <span className="font-mono text-2xl font-semibold">{count === undefined ? "—" : count}</span>
            </button>
          );
        })}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">Large files<FileWarning size={16} className="text-muted-foreground" /></span>
          <span className="font-mono text-2xl font-semibold">{data ? data.large_files.length : "—"}</span>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5" aria-label={active.label}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{active.label}</h2>
          <label className="flex min-w-60 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
            <Search size={14} className="text-muted-foreground" />
            <input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Filter by path or text" aria-label="Filter findings" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
          </label>
        </header>
        {!data ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">{loading ? <><LoaderCircle size={16} className="animate-spin" />Scanning indexed files…</> : "No scan results yet."}</div>
        ) : visible.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">{filter ? "No findings match the filter." : active.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/70">
            {visible.map(finding => (
              <li key={`${finding.path}:${finding.line}:${finding.rule}`} className="flex items-start gap-3 py-3">
                <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_STYLES[finding.severity]}`}>{finding.severity}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{finding.title}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground" title={`${finding.path}:${finding.line}`}>{finding.path}:{finding.line}</p>
                  <pre className="mt-1.5 overflow-x-auto rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs">{finding.snippet}</pre>
                </div>
                <button type="button" className={buttonClass} aria-label={`Open ${finding.path} at line ${finding.line}`} onClick={() => onOpenInEditor(finding.path, finding.line)}>Open</button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          These are heuristics to review, not proof of a problem. Complexity counts 1 plus each branch (if, loop, catch, case, ternary, and/or) in a function. Secrets are shown redacted. Add <code className="rounded bg-muted px-1">ifrog-ignore</code> to a line, or <code className="rounded bg-muted px-1">ifrog-ignore-file</code> near the top of a file, to silence it. Files ignored by Git are not scanned.
        </p>
      </section>

      {data && data.large_files.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5" aria-label="Large files">
          <h2 className="text-base font-semibold">Large files</h2>
          <ul className="flex flex-col divide-y divide-border/70">
            {data.large_files.map(file => (
              <li key={file.path} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="min-w-0 truncate font-mono" title={file.path}>{file.path}</span>
                <span className="shrink-0 font-mono text-muted-foreground">{formatSize(file.size_bytes)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

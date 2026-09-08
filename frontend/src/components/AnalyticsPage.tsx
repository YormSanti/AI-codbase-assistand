import { useState, useMemo } from 'react';
import {
  BarChart3,
  FileText,
  Folder,
  HardDrive,
  Code2,
  PieChart as PieChartIcon,
  Layers,
  TrendingUp,
  Sparkles,
  Bot,
  FolderTree,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { RepositoryInfo, TreeNode } from '../types/domain';

interface Props {
  repository: RepositoryInfo | null;
  tree: TreeNode | null;
  onNavigate?: (tab: string) => void;
  onOpen?: (path: string) => Promise<void> | void;
}

const LANG_COLORS: Record<string, string> = {
  typescript: '#3178c6',
  tsx: '#f472b6',
  javascript: '#f7df1e',
  jsx: '#fb923c',
  python: '#3b82f6',
  rust: '#f97316',
  go: '#00add8',
  java: '#ef4444',
  c: '#6366f1',
  cpp: '#818cf8',
  csharp: '#10b981',
  ruby: '#e11d48',
  php: '#8b5cf6',
  json: '#a855f7',
  yaml: '#64748b',
  toml: '#d97706',
  markdown: '#4ade80',
  html: '#ea580c',
  css: '#38bdf8',
  shell: '#22c55e',
  sql: '#eab308',
  other: '#64748b',
};

const EXT_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  markdown: 'markdown',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'css',
  sass: 'css',
  less: 'css',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  sql: 'sql',
  svg: 'html',
  xml: 'other',
};

const getLanguage = (node: TreeNode): string => {
  if (node.language && node.language !== 'other') {
    return node.language;
  }
  const parts = node.name.split('.');
  if (parts.length > 1) {
    const ext = parts[parts.length - 1].toLowerCase();
    if (EXT_MAP[ext]) return EXT_MAP[ext];
  }
  return node.language || 'other';
};

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export function AnalyticsPage({ repository, tree, onNavigate }: Props) {
  const [metricMode, setMetricMode] = useState<'count' | 'size'>('count');
  const [chartType, setChartType] = useState<'bar' | 'donut'>('bar');

  const stats = useMemo(() => {
    let files = 0;
    let dirs = 0;
    let totalBytes = 0;
    const langStats: Record<string, { count: number; bytes: number }> = {};
    const allFiles: { name: string; path: string; size: number; lang: string }[] = [];

    const sizeTiers = {
      tiny: { label: '< 1 KB', count: 0, bytes: 0 },
      small: { label: '1 - 10 KB', count: 0, bytes: 0 },
      medium: { label: '10 - 50 KB', count: 0, bytes: 0 },
      large: { label: '50 - 200 KB', count: 0, bytes: 0 },
      huge: { label: '> 200 KB', count: 0, bytes: 0 },
    };

    const walk = (node: TreeNode) => {
      if (node.is_directory) {
        dirs++;
        node.children?.forEach(walk);
      } else {
        files++;
        const size = node.size_bytes || 0;
        totalBytes += size;
        const lang = getLanguage(node);

        if (!langStats[lang]) {
          langStats[lang] = { count: 0, bytes: 0 };
        }
        langStats[lang].count += 1;
        langStats[lang].bytes += size;

        if (size < 1024) sizeTiers.tiny.count += 1;
        else if (size < 10 * 1024) sizeTiers.small.count += 1;
        else if (size < 50 * 1024) sizeTiers.medium.count += 1;
        else if (size < 200 * 1024) sizeTiers.large.count += 1;
        else sizeTiers.huge.count += 1;

        allFiles.push({
          name: node.name,
          path: node.path,
          size,
          lang,
        });
      }
    };

    if (tree) {
      walk(tree);
      dirs = Math.max(0, dirs - 1);
    }

    const avgFileSize = files > 0 ? Math.round(totalBytes / files) : 0;

    const sortedLangs = Object.entries(langStats)
      .map(([lang, data]) => ({
        lang,
        count: data.count,
        bytes: data.bytes,
        formattedBytes: formatBytes(data.bytes),
        countPct: files > 0 ? parseFloat(((data.count / files) * 100).toFixed(1)) : 0,
        sizePct: totalBytes > 0 ? parseFloat(((data.bytes / totalBytes) * 100).toFixed(1)) : 0,
        color: LANG_COLORS[lang] || LANG_COLORS.other,
      }))
      .sort((a, b) => (metricMode === 'count' ? b.count - a.count : b.bytes - a.bytes));

    const topFiles = allFiles.sort((a, b) => b.size - a.size).slice(0, 10);

    const sizeTierData = [
      { name: '< 1 KB', files: sizeTiers.tiny.count, color: '#38bdf8' },
      { name: '1-10 KB', files: sizeTiers.small.count, color: '#34d399' },
      { name: '10-50 KB', files: sizeTiers.medium.count, color: '#fbbf24' },
      { name: '50-200 KB', files: sizeTiers.large.count, color: '#fb923c' },
      { name: '> 200 KB', files: sizeTiers.huge.count, color: '#f43f5e' },
    ];

    const topLanguage = sortedLangs[0];

    return {
      files,
      dirs,
      totalBytes,
      avgFileSize,
      sortedLangs,
      topFiles,
      sizeTierData,
      totalLangs: sortedLangs.length,
      topLanguage,
      hugeFilesCount: sizeTiers.huge.count,
    };
  }, [tree, metricMode]);

  // Empty state when no repository or tree is loaded
  if (!repository || !tree) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-0 w-full p-8 text-center bg-background">
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-500/10 to-transparent shadow-[0_0_40px_-10px_rgba(139,92,246,0.3)]">
          <BarChart3 className="h-10 w-10 text-violet-400" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Codebase Analytics & Charts</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
          Open or select a local repository to visualize code composition, file size distributions, and architectural metrics.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-950/40 hover:bg-violet-500 transition-colors"
            >
              <Folder className="h-4 w-4" />
              <span>Browse Projects</span>
            </button>
          )}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('explorer')}
              className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-card hover:border-violet-500/30 transition-colors"
            >
              <FolderTree className="h-4 w-4 text-violet-400" />
              <span>File Explorer</span>
            </button>
          )}
        </div>

        {/* Feature previews */}
        <div className="mt-12 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3 text-left">
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <PieChartIcon className="h-5 w-5 text-indigo-400 mb-2" />
            <h4 className="text-xs font-semibold text-foreground">Language Distribution</h4>
            <p className="mt-1 text-[11px] text-muted-foreground">Interactive breakdown of codebase composition by files and byte volume.</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <Layers className="h-5 w-5 text-emerald-400 mb-2" />
            <h4 className="text-xs font-semibold text-foreground">Size Tier Analysis</h4>
            <p className="mt-1 text-[11px] text-muted-foreground">Identify monolithic modules and track file granularity.</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <Sparkles className="h-5 w-5 text-amber-400 mb-2" />
            <h4 className="text-xs font-semibold text-foreground">Tree-sitter Powered</h4>
            <p className="mt-1 text-[11px] text-muted-foreground">Deep AST parsing and metadata generated directly from local disk.</p>
          </div>
        </div>
      </div>
    );
  }

  const cardClass = 'rounded-2xl border border-border bg-card/80 p-6 shadow-sm flex flex-col';

  return (
    <div className="flex-1 w-full min-h-0 overflow-y-auto p-6 md:p-8 space-y-6 text-foreground bg-background">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Code Analytics</h1>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                {repository.name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-md">
              {repository.root_path} • {repository.current_branch || 'main'}
            </p>
          </div>
        </div>

        {onNavigate && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('explorer')}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <FolderTree className="h-3.5 w-3.5" />
              <span>Explorer</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ai')}
              className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/20 transition-colors"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>AI Review</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Top Metric Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Total Files',
            value: stats.files.toLocaleString(),
            sub: `${stats.dirs} directories`,
            icon: <FileText className="h-5 w-5 text-blue-400" />,
            border: 'border-blue-500/30',
            bg: 'bg-blue-500/5',
          },
          {
            label: 'Codebase Volume',
            value: formatBytes(stats.totalBytes),
            sub: `Avg ${formatBytes(stats.avgFileSize)} per file`,
            icon: <HardDrive className="h-5 w-5 text-purple-400" />,
            border: 'border-purple-500/30',
            bg: 'bg-purple-500/5',
          },
          {
            label: 'Languages',
            value: stats.totalLangs,
            sub: stats.topLanguage ? `${stats.topLanguage.lang} leads (${metricMode === 'count' ? stats.topLanguage.countPct : stats.topLanguage.sizePct}%)` : 'None',
            icon: <Code2 className="h-5 w-5 text-emerald-400" />,
            border: 'border-emerald-500/30',
            bg: 'bg-emerald-500/5',
          },
          {
            label: 'Large Files (>200KB)',
            value: stats.hugeFilesCount,
            sub: stats.hugeFilesCount > 0 ? 'Review candidates' : 'Clean & modular',
            icon: <AlertTriangle className={`h-5 w-5 ${stats.hugeFilesCount > 0 ? 'text-amber-400' : 'text-zinc-500'}`} />,
            border: stats.hugeFilesCount > 0 ? 'border-amber-500/30' : 'border-border',
            bg: stats.hugeFilesCount > 0 ? 'bg-amber-500/5' : 'bg-card',
          },
        ].map((metric, i) => (
          <div
            key={i}
            className={`relative rounded-2xl border ${metric.border} ${metric.bg} p-5 shadow-sm transition-all duration-200 hover:border-violet-500/40`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{metric.label}</span>
              <div className="rounded-lg bg-background/80 p-2 border border-border">{metric.icon}</div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-foreground font-mono">{metric.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{metric.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Interactive Charts Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Language Distribution Chart (2 cols) */}
        <div className={`${cardClass} lg:col-span-2`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border/60">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Code2 className="h-4 w-4 text-violet-400" />
                Language Composition
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Breakdown of code by {metricMode === 'count' ? 'indexed file count' : 'total byte size'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Count vs Size Toggle */}
              <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMetricMode('count')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${metricMode === 'count' ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Files
                </button>
                <button
                  type="button"
                  onClick={() => setMetricMode('size')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${metricMode === 'size' ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Size
                </button>
              </div>

              {/* Chart Type Toggle */}
              <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setChartType('bar')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${chartType === 'bar' ? 'bg-zinc-800 text-zinc-100' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Bar Chart"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('donut')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${chartType === 'donut' ? 'bg-zinc-800 text-zinc-100' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Donut Chart"
                >
                  <PieChartIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 flex-1 min-h-[300px]">
            {stats.sortedLangs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No indexed language data available.
              </div>
            ) : chartType === 'bar' ? (
              <div className="h-[280px] w-full" data-testid="language-bar-chart">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 280 }}>
                  <BarChart
                    data={stats.sortedLangs.slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 70, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      type="number"
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="lang"
                      tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 500 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-xl">
                            <div className="flex items-center gap-2 font-semibold text-foreground capitalize">
                              <span className="h-2 w-2 rounded-full" style={{ background: data.color }} />
                              {data.lang}
                            </div>
                            <div className="mt-1.5 space-y-1 text-muted-foreground">
                              <div>Files: <span className="font-mono text-foreground font-semibold">{data.count}</span> ({data.countPct}%)</div>
                              <div>Volume: <span className="font-mono text-foreground font-semibold">{data.formattedBytes}</span> ({data.sizePct}%)</div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey={metricMode === 'count' ? 'count' : 'bytes'}
                      radius={[0, 6, 6, 0]}
                    >
                      {stats.sortedLangs.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 h-[280px] w-full" data-testid="language-donut-chart">
                <div className="h-[240px] w-[240px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 240, height: 240 }}>
                    <PieChart>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-xl">
                              <div className="flex items-center gap-2 font-semibold text-foreground capitalize">
                                <span className="h-2 w-2 rounded-full" style={{ background: data.color }} />
                                {data.lang}
                              </div>
                              <div className="mt-1 text-muted-foreground">
                                {metricMode === 'count'
                                  ? `${data.count} files (${data.countPct}%)`
                                  : `${data.formattedBytes} (${data.sizePct}%)`}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Pie
                        data={stats.sortedLangs.slice(0, 8)}
                        dataKey={metricMode === 'count' ? 'count' : 'bytes'}
                        nameKey="lang"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                      >
                        {stats.sortedLangs.slice(0, 8).map((entry, index) => (
                          <Cell key={`donut-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-2 w-full max-w-[200px]">
                  {stats.sortedLangs.slice(0, 8).map((item) => (
                    <div key={item.lang} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
                        <span className="truncate capitalize text-foreground">{item.lang}</span>
                      </div>
                      <span className="font-mono text-muted-foreground text-[11px]">
                        {metricMode === 'count' ? `${item.countPct}%` : `${item.sizePct}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Size Tier Distribution Chart (1 col) */}
        <div className={cardClass}>
          <div className="pb-4 border-b border-border/60">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-400" />
              File Granularity
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Files grouped by size brackets</p>
          </div>

          <div className="pt-6 flex-1 min-h-[240px]" data-testid="size-tier-chart">
            <ResponsiveContainer width="100%" height={220} initialDimension={{ width: 280, height: 220 }}>
              <BarChart data={stats.sizeTierData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-xl">
                        <div className="font-semibold text-foreground">{data.name}</div>
                        <div className="mt-1 text-muted-foreground">
                          Files: <span className="font-mono text-foreground font-semibold">{data.files}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="files" radius={[6, 6, 0, 0]}>
                  {stats.sizeTierData.map((entry, index) => (
                    <Cell key={`tier-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>Average file size</span>
            <span className="font-mono font-semibold text-foreground">{formatBytes(stats.avgFileSize)}</span>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Top Files & Insights ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Largest Files */}
        <div className={cardClass}>
          <div className="pb-4 border-b border-border/60 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                Largest Files by Size
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Top source & asset files consuming repository storage</p>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">Top {stats.topFiles.length}</span>
          </div>

          <div className="pt-4 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {stats.topFiles.map((file, idx) => {
              const pct = stats.totalBytes > 0 ? ((file.size / stats.totalBytes) * 100).toFixed(1) : '0';
              const color = LANG_COLORS[file.lang] || LANG_COLORS.other;

              return (
                <div
                  key={file.path || idx}
                  className="group flex flex-col gap-1.5 rounded-xl border border-border/50 bg-background/50 p-3 hover:border-violet-500/30 hover:bg-background transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-mono text-xs text-muted-foreground/80 w-5 shrink-0">#{idx + 1}</span>
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-xs font-medium text-foreground font-mono" title={file.path}>
                        {file.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: `${color}18`,
                          color,
                          border: `1px solid ${color}35`,
                        }}
                      >
                        {file.lang}
                      </span>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                  </div>

                  {/* Proportional visual bar */}
                  <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(Number(pct), 2)}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Codebase Architecture & Health */}
        <div className={cardClass}>
          <div className="pb-4 border-b border-border/60">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Codebase Insights & Health
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Automated architectural observations</p>
          </div>

          <div className="pt-4 space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <span className="font-semibold text-foreground">Tree-sitter AST Ready: </span>
                <span className="text-muted-foreground">
                  {stats.files} files indexed across {stats.dirs} directories. Symbols, functions, and import graphs are fully searchable.
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background/50 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Dominant Stack</span>
                <span className="font-mono font-semibold capitalize" style={{ color: stats.topLanguage?.color }}>
                  {stats.topLanguage?.lang} ({stats.topLanguage?.countPct}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${stats.topLanguage?.countPct || 0}%`,
                    background: stats.topLanguage?.color || '#3b82f6',
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background/50 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">File Granularity</span>
                <span className="font-mono font-semibold text-foreground">
                  {stats.avgFileSize < 20 * 1024 ? 'Highly Modular' : 'Standard'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Average file is {formatBytes(stats.avgFileSize)}. {stats.sizeTierData[0].files + stats.sizeTierData[1].files} files are under 10 KB.
              </p>
            </div>

            {stats.hugeFilesCount > 0 ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-semibold text-foreground">Large Files Detected: </span>
                  <span className="text-muted-foreground">
                    {stats.hugeFilesCount} files exceed 200 KB. Consider splitting or inspecting with the File Inspector.
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-semibold text-foreground">Healthy Size Distribution: </span>
                  <span className="text-muted-foreground">
                    No files exceed 200 KB. The repository exhibits clean modular structure.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

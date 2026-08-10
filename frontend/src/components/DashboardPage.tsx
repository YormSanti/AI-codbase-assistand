import { useState, useEffect } from "react";
import type { RepositoryInfo, TreeNode } from "../types/domain";
import {
  FolderGit2, GitBranch, FileCode2, Zap, Bot, Terminal,
  Play, ChevronRight, BarChart3, Clock, TrendingUp,
  Star, GitCommit, Layers, Shield, Search, ArrowRight,
  Activity, Code2, Sparkles, Database, GitMerge,
  AlertCircle, CheckCircle2, Circle,
} from "lucide-react";

interface Props {
  repository: RepositoryInfo | null;
  tree: TreeNode | null;
  isLoading: boolean;
  onOpen: (path: string) => void;
  onNavigate: (tab: string) => void;
}

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

const QUICK_ACTIONS = [
  { icon: Bot, label: "Run AI Agent", desc: "Autonomous code analysis", color: "#a78bfa", bg: "rgba(124,58,237,0.12)", border: "rgba(139,92,246,0.35)", tab: "ai" },
  { icon: Terminal, label: "File Explorer", desc: "Browse repository tree", color: "#60a5fa", bg: "rgba(37,99,235,0.10)", border: "rgba(59,130,246,0.35)", tab: "explorer" },
  { icon: GitBranch, label: "Git Overview", desc: "Branches & commits", color: "#34d399", bg: "rgba(16,185,129,0.10)", border: "rgba(52,211,153,0.35)", tab: "git" },
  { icon: Shield, label: "Security Audit", desc: "Scan for vulnerabilities", color: "#f472b6", bg: "rgba(236,72,153,0.10)", border: "rgba(244,114,182,0.35)", tab: "ai" },
];

const RECENT_ACTIVITY = [
  { type: "commit", icon: GitCommit, label: "feat: add AI Agent page", time: "2m ago", color: "#a78bfa" },
  { type: "file", icon: FileCode2, label: "AIAgentPage.tsx modified", time: "4m ago", color: "#60a5fa" },
  { type: "build", icon: CheckCircle2, label: "Production build passed", time: "6m ago", color: "#34d399" },
  { type: "test", icon: CheckCircle2, label: "11/11 tests passing", time: "7m ago", color: "#34d399" },
  { type: "file", icon: FileCode2, label: "App.css redesigned", time: "12m ago", color: "#60a5fa" },
  { type: "commit", icon: GitCommit, label: "fix: border spacing margins", time: "15m ago", color: "#a78bfa" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function DashboardPage({ repository, tree, isLoading, onOpen, onNavigate }: Props) {
  const { total, byLang } = countFiles(tree);
  const topLangs = Object.entries(byLang).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%", padding: "20px" }}>

      {/* ── Welcome Hero ─────────────────────────────────────────────────── */}
      <div style={{
        position: "relative", overflow: "hidden",
        padding: "40px 44px", borderRadius: "24px",
        background: "linear-gradient(135deg, rgba(88,28,255,0.18) 0%, rgba(37,99,235,0.12) 50%, rgba(16,185,129,0.06) 100%)",
        border: "1.5px solid rgba(139,92,246,0.30)",
        boxShadow: "0 16px 48px -12px rgba(88,28,255,0.2)",
      }}>
        {/* bg glow orbs */}
        <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-40px", left: "40%", width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{ padding: "12px", borderRadius: "16px", background: "linear-gradient(135deg,#7c3aed,#2563eb)", boxShadow: "0 8px 20px -4px rgba(124,58,237,0.5)" }}>
                <Sparkles style={{ width: "24px", height: "24px", color: "white" }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1.5px", color: "rgba(167,139,250,0.9)" }}>DevPilot AI</p>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--muted-foreground)" }}>Intelligence Platform</p>
              </div>
            </div>
            <h1 style={{ margin: "0 0 12px 0", fontSize: "32px", fontWeight: "900", color: "var(--foreground)", letterSpacing: "-0.75px", lineHeight: 1.15 }}>
              {repository ? `Welcome back 👋` : "Good morning 👋"}
            </h1>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--muted-foreground)", lineHeight: "1.6", maxWidth: "500px" }}>
              {repository
                ? `Currently analyzing <strong>${repository.name}</strong> — ${repository.file_count} indexed files on branch <code>${repository.current_branch || "main"}</code>.`
                : "Open a repository to start exploring code intelligence, AST analysis, and AI-powered refactoring."}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
            <div style={{ fontSize: "13px", color: "var(--muted-foreground)", textAlign: "right" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--foreground)", fontWeight: "600" }}>
                <Clock style={{ width: "14px", height: "14px" }} />
                {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span style={{ fontSize: "11px" }}>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
            </div>
            {!repository && (
              <button
                onClick={() => onOpen("/home/ksk/AI-Git-assistand/frontend")}
                disabled={isLoading}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "12px 24px", borderRadius: "14px", border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg,#7c3aed,#4f46e5,#2563eb)",
                  color: "white", fontSize: "13px", fontWeight: "700",
                  boxShadow: "0 8px 20px -4px rgba(124,58,237,0.4)",
                }}
              >
                <Play style={{ width: "14px", height: "14px" }} />
                Open Workspace Repo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stat Cards Row ───────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
        {[
          { icon: FileCode2, label: "Total Files", value: repository ? String(repository.file_count) : "—", sub: "indexed source files", color: "#60a5fa", bg: "rgba(37,99,235,0.10)", border: "rgba(59,130,246,0.25)" },
          { icon: GitBranch, label: "Active Branch", value: repository ? (repository.current_branch || "main") : "—", sub: "current checkout", color: "#a78bfa", bg: "rgba(124,58,237,0.10)", border: "rgba(139,92,246,0.25)" },
          { icon: GitCommit, label: "HEAD Commit", value: repository ? (repository.head_commit?.slice(0, 7) || "—") : "—", sub: "latest commit hash", color: "#34d399", bg: "rgba(16,185,129,0.10)", border: "rgba(52,211,153,0.25)" },
          { icon: BarChart3, label: "Languages", value: topLangs.length > 0 ? String(topLangs.length) : "—", sub: "detected in codebase", color: "#fb923c", bg: "rgba(251,146,60,0.10)", border: "rgba(251,146,60,0.25)" },
        ].map(({ icon: Icon, label, value, sub, color, bg, border }) => (
          <div key={label} style={{
            padding: "24px 22px", borderRadius: "20px",
            background: bg, border: `1.5px solid ${border}`,
            display: "flex", flexDirection: "column", gap: "14px",
            boxShadow: "0 4px 16px -4px rgba(0,0,0,0.2)",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</span>
              <div style={{ padding: "8px", borderRadius: "10px", background: "rgba(255,255,255,0.08)" }}>
                <Icon style={{ width: "16px", height: "16px", color }} />
              </div>
            </div>
            <div>
              <p style={{ margin: "0 0 4px 0", fontSize: "26px", fontWeight: "800", color: "var(--foreground)", letterSpacing: "-0.5px", fontFamily: "var(--font-code)" }}>{value}</p>
              <p style={{ margin: 0, fontSize: "11px", color: "var(--muted-foreground)" }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Middle Row: Quick Actions + Lang Breakdown ───────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>

        {/* Quick Actions */}
        <div style={{
          padding: "28px 28px", borderRadius: "20px",
          background: "rgba(18,18,24,0.9)", border: "1.5px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px -8px rgba(0,0,0,0.4)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Zap style={{ width: "16px", height: "16px", color: "#fbbf24" }} />
              <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--foreground)" }}>Quick Actions</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            {QUICK_ACTIONS.map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => onNavigate(action.tab)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "14px",
                    padding: "20px 18px", borderRadius: "16px",
                    background: action.bg, border: `1.5px solid ${action.border}`,
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s ease",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px -4px rgba(0,0,0,0.3)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = ""; }}
                >
                  <div style={{ padding: "10px", borderRadius: "12px", background: "rgba(255,255,255,0.08)", flexShrink: 0 }}>
                    <Icon style={{ width: "18px", height: "18px", color: action.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--foreground)" }}>{action.label}</span>
                      <ArrowRight style={{ width: "13px", height: "13px", color: "var(--muted-foreground)" }} />
                    </div>
                    <p style={{ margin: 0, fontSize: "11px", color: "var(--muted-foreground)", lineHeight: "1.4" }}>{action.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language Breakdown */}
        <div style={{
          padding: "28px", borderRadius: "20px",
          background: "rgba(18,18,24,0.9)", border: "1.5px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px -8px rgba(0,0,0,0.4)",
          display: "flex", flexDirection: "column", gap: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Code2 style={{ width: "16px", height: "16px", color: "#a78bfa" }} />
            <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--foreground)" }}>Language Breakdown</span>
          </div>

          {topLangs.length > 0 ? (
            <>
              {/* Stacked bar */}
              <div style={{ height: "10px", borderRadius: "99px", overflow: "hidden", display: "flex", gap: "2px" }}>
                {topLangs.map(([lang, count]) => (
                  <div key={lang} style={{
                    flex: count, height: "100%",
                    background: LANG_COLORS[lang] ?? "#475569",
                    borderRadius: "99px",
                  }} />
                ))}
              </div>

              {/* Lang list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {topLangs.map(([lang, count]) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={lang} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: LANG_COLORS[lang] ?? "#475569", flexShrink: 0, boxShadow: `0 0 6px ${LANG_COLORS[lang] ?? "#475569"}` }} />
                      <span style={{ flex: 1, fontSize: "12px", fontWeight: "600", color: "var(--foreground)" }}>{LANG_LABELS[lang] ?? lang}</span>
                      <span style={{ fontSize: "11px", color: "var(--muted-foreground)", fontFamily: "var(--font-code)" }}>{count} files</span>
                      <div style={{ width: "60px", height: "5px", borderRadius: "99px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: "99px", background: LANG_COLORS[lang] ?? "#475569" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "var(--muted-foreground)", textAlign: "center" }}>
              <Database style={{ width: "32px", height: "32px", opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: "12px" }}>Open a repository to see language breakdown</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row: System Status + Recent Activity ───────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

        {/* Recent Activity */}
        <div style={{
          padding: "28px", borderRadius: "20px",
          background: "rgba(18,18,24,0.9)", border: "1.5px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px -8px rgba(0,0,0,0.4)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <Activity style={{ width: "16px", height: "16px", color: "#34d399" }} />
            <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--foreground)" }}>Recent Activity</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {RECENT_ACTIVITY.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: "14px",
                  padding: "14px 0",
                  borderBottom: i < RECENT_ACTIVITY.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon style={{ width: "14px", height: "14px", color: item.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 3px 0", fontSize: "12px", fontWeight: "600", color: "var(--foreground)" }}>{item.label}</p>
                    <p style={{ margin: 0, fontSize: "11px", color: "var(--muted-foreground)" }}>{item.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Status */}
        <div style={{
          padding: "28px", borderRadius: "20px",
          background: "rgba(18,18,24,0.9)", border: "1.5px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px -8px rgba(0,0,0,0.4)",
          display: "flex", flexDirection: "column", gap: "20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Shield style={{ width: "16px", height: "16px", color: "#f472b6" }} />
            <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--foreground)" }}>System Status</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { label: "Backend API", status: "Operational", color: "#34d399", bg: "rgba(16,185,129,0.12)", border: "rgba(52,211,153,0.3)" },
              { label: "Tree-sitter Parser", status: "Active", color: "#34d399", bg: "rgba(16,185,129,0.12)", border: "rgba(52,211,153,0.3)" },
              { label: "AI Agent Engine", status: "Ready", color: "#34d399", bg: "rgba(16,185,129,0.12)", border: "rgba(52,211,153,0.3)" },
              { label: "SQLite Repository DB", status: "Connected", color: "#34d399", bg: "rgba(16,185,129,0.12)", border: "rgba(52,211,153,0.3)" },
              { label: "Git Integration", status: repository ? "Active" : "No Repo", color: repository ? "#34d399" : "#fbbf24", bg: repository ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)", border: repository ? "rgba(52,211,153,0.3)" : "rgba(245,158,11,0.3)" },
            ].map(({ label, status, color, bg, border }) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px", borderRadius: "14px",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--foreground)" }}>{label}</span>
                <span style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  fontSize: "11px", fontWeight: "700", padding: "4px 12px",
                  borderRadius: "99px", background: bg, border: `1px solid ${border}`, color,
                }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
                  {status}
                </span>
              </div>
            ))}
          </div>

          {/* AI Agent call to action */}
          <button
            onClick={() => onNavigate("ai")}
            style={{
              marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              padding: "14px 20px", borderRadius: "14px", border: "none", cursor: "pointer",
              background: "linear-gradient(135deg,#7c3aed,#4f46e5,#2563eb)",
              color: "white", fontSize: "13px", fontWeight: "700",
              boxShadow: "0 8px 20px -4px rgba(124,58,237,0.35)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 12px 28px -4px rgba(124,58,237,0.5)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 20px -4px rgba(124,58,237,0.35)"; }}
          >
            <Bot style={{ width: "16px", height: "16px" }} />
            Launch AI Agent Studio
            <ChevronRight style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

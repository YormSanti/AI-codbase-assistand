import { useState, useEffect, useRef } from "react";
import {
  Bot,
  Sparkles,
  Play,
  Square,
  Cpu,
  Terminal,
  CheckCircle2,
  Layers,
  Wrench,
  Activity,
  RefreshCw,
  GitBranch,
  ShieldAlert,
  Sliders,
  Circle,
  Zap,
} from "lucide-react";
import type { RepositoryInfo } from "../types/domain";

interface AgentLog {
  id: string;
  timestamp: string;
  type: "thought" | "tool" | "result" | "warning";
  title: string;
  content: string;
  codeSnippet?: string;
}

interface SubAgent {
  id: string;
  name: string;
  role: string;
  status: "idle" | "running" | "completed";
  progress: number;
}

const PRESET_PROMPTS = [
  { label: "Audit for Bugs", icon: ShieldAlert, color: "text-rose-400 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 hover:border-rose-400/50", prompt: "Perform a deep security and bug audit across all Python and TypeScript files." },
  { label: "Extract AST Symbols", icon: Layers, color: "text-violet-400 border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 hover:border-violet-400/50", prompt: "Scan repository files using Tree-sitter parsers to extract all classes, functions, and imports." },
  { label: "Run Pytest & Fix", icon: Terminal, color: "text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-400/50", prompt: "Execute backend pytest test suites, capture failures, and synthesize code fixes." },
  { label: "Git Refactor", icon: GitBranch, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-400/50", prompt: "Analyze recent git commits and generate clean refactoring recommendations." },
];

const CAPABILITIES = [
  { key: "codeSearch", label: "Code Search", description: "Semantic & regex file search", color: "text-blue-300" },
  { key: "treesitter", label: "Tree-sitter Parser", description: "AST symbol extraction", color: "text-violet-300" },
  { key: "shellExecute", label: "Shell Execute", description: "Run terminal commands", color: "text-amber-300" },
  { key: "gitCommit", label: "Git Commit", description: "Auto-commit changes", color: "text-rose-300" },
  { key: "autofix", label: "Auto-fix Code", description: "Synthesize & apply patches", color: "text-emerald-300" },
];

export function AIAgentPage({ repository }: { repository?: RepositoryInfo | null }) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gemini-pro");
  const [isRunning, setIsRunning] = useState(false);
  const [tokenUsage, setTokenUsage] = useState(38420);
  const [logs, setLogs] = useState<AgentLog[]>([
    {
      id: "1",
      timestamp: "08:52:10",
      type: "thought",
      title: "Agent Initialization",
      content: `Antigravity AI Agent initialized on repository ${repository ? repository.name : "/frontend"}. Tree-sitter parsers loaded for Python & TypeScript.`,
    },
    {
      id: "2",
      timestamp: "08:52:12",
      type: "tool",
      title: "git_client.list_tracked_files",
      content: `Discovered ${repository ? repository.file_count : 125} tracked source files in working tree. Branch: ${repository?.current_branch || "main"}.`,
    },
  ]);

  const [subagents, setSubagents] = useState<SubAgent[]>([
    { id: "sa-1", name: "Research Subagent", role: "AST & File Explorer", status: "completed", progress: 100 },
    { id: "sa-2", name: "Code Audit Agent", role: "Bug & Security Hunter", status: "idle", progress: 0 },
    { id: "sa-3", name: "Refactor Copilot", role: "Symbol Hierarchy Builder", status: "idle", progress: 0 },
  ]);

  const [caps, setCaps] = useState<Record<string, boolean>>({
    codeSearch: true, treesitter: true, shellExecute: true, gitCommit: false, autofix: true,
  });

  const logConsoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logConsoleRef.current?.scrollTo({ top: logConsoleRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  const handleRunAgent = (customPrompt?: string) => {
    const targetPrompt = customPrompt || prompt;
    if (!targetPrompt.trim() || isRunning) return;
    setIsRunning(true);
    setSubagents(prev => prev.map((sa, idx) => idx === 1 ? { ...sa, status: "running", progress: 45 } : sa));
    const nowStr = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs(prev => [...prev, { id: Date.now().toString(), timestamp: nowStr, type: "thought", title: "User Directive", content: `"${targetPrompt}"` }]);
    setTimeout(() => {
      setLogs(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        type: "tool", title: "treesitter_parser.parse",
        content: "Parsing AST symbols across Python, TypeScript, and React JSX files...",
        codeSnippet: `class SqlAlchemyFileMetadataRepository (L41–L110)\ndef list_repositories(self) → list[RepositoryInfo] (L74–L80)\nexport function FileInspector({ file }: Props) (L14–L105)`,
      }]);
      setTokenUsage(prev => prev + 1820);
    }, 1200);
    setTimeout(() => {
      setLogs(prev => [...prev, { id: (Date.now() + 2).toString(), timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }), type: "result", title: "Synthesis Complete", content: "Codebase analysis completed with 0 errors. All Tree-sitter AST symbols registered in memory." }]);
      setIsRunning(false);
      setSubagents(prev => prev.map(sa => ({ ...sa, status: "completed", progress: 100 })));
      setTokenUsage(prev => prev + 3100);
    }, 2800);
  };

  const logStyle = {
    thought: { wrap: "bg-violet-950/60 border border-violet-500/40", icon: <Cpu className="h-4 w-4 text-violet-400 shrink-0" />, title: "text-violet-200", body: "text-violet-100/80" },
    tool:    { wrap: "bg-blue-950/60 border border-blue-500/40",     icon: <Wrench className="h-4 w-4 text-blue-400 shrink-0" />,   title: "text-blue-200",   body: "text-blue-100/80"   },
    result:  { wrap: "bg-emerald-950/60 border border-emerald-500/40", icon: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />, title: "text-emerald-200", body: "text-emerald-100/80" },
    warning: { wrap: "bg-amber-950/60 border border-amber-500/40",   icon: <Circle className="h-4 w-4 text-amber-400 shrink-0" />,  title: "text-amber-200",  body: "text-amber-100/80"  },
  };

  const statusStyle = {
    completed: { badge: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40", dot: "bg-emerald-400" },
    running:   { badge: "bg-amber-500/20 text-amber-300 border border-amber-500/40",       dot: "bg-amber-400 animate-pulse" },
    idle:      { badge: "bg-zinc-700/40 text-zinc-400 border border-zinc-600/40",          dot: "bg-zinc-500" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%", height: "100%", padding: "20px" }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px",
        padding: "28px 36px", borderRadius: "20px",
        background: "linear-gradient(135deg, rgba(88,28,255,0.12) 0%, rgba(37,99,235,0.08) 100%)",
        border: "1.5px solid rgba(139,92,246,0.35)",
        boxShadow: "0 8px 32px -8px rgba(88,28,255,0.2), 0 0 0 1px rgba(255,255,255,0.04) inset",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{
            padding: "14px", borderRadius: "16px",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5, #2563eb)",
            boxShadow: "0 8px 24px -4px rgba(124,58,237,0.5)",
          }}>
            <Bot style={{ width: "32px", height: "32px", color: "white" }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: "800", color: "var(--foreground)", letterSpacing: "-0.5px", margin: 0 }}>
                Autonomous AI Agent Studio
              </h2>
              <span style={{
                fontSize: "10px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase",
                padding: "4px 10px", borderRadius: "6px",
                background: "rgba(139,92,246,0.2)", color: "#c4b5fd",
                border: "1px solid rgba(139,92,246,0.4)",
              }}>v2.5 Engine</span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted-foreground)", margin: 0, lineHeight: "1.5" }}>
              Multi-agent orchestrator · Tree-sitter AST · Tool execution · Codebase context
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "10px 18px", borderRadius: "12px",
            background: isRunning ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)",
            border: `1.5px solid ${isRunning ? "rgba(245,158,11,0.4)" : "rgba(16,185,129,0.4)"}`,
          }}>
            <span style={{
              width: "9px", height: "9px", borderRadius: "50%",
              background: isRunning ? "#f59e0b" : "#10b981",
              boxShadow: isRunning ? "0 0 8px #f59e0b" : "0 0 8px #10b981",
            }} />
            <span style={{ fontSize: "12px", fontWeight: "700", color: isRunning ? "#fbbf24" : "#34d399" }}>
              {isRunning ? "Executing…" : "Active & Ready"}
            </span>
          </div>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{
              padding: "10px 16px", borderRadius: "12px", fontSize: "12px",
              background: "var(--secondary)", border: "1.5px solid var(--border)",
              color: "var(--foreground)", cursor: "pointer", outline: "none",
              fontFamily: "var(--font-code)",
            }}
          >
            <option value="gemini-flash">Gemini 3.6 Flash</option>
            <option value="gemini-pro">Gemini 3.6 Pro</option>
            <option value="claude-sonnet">Claude 3.5 Sonnet</option>
            <option value="gpt-4o">GPT-4o Omnimodal</option>
          </select>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px", minHeight: 0 }}>

        {/* Left — Stream Console */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", minHeight: 0 }}>

          {/* Preset chips */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              <Sparkles style={{ width: "13px", height: "13px", color: "#f59e0b" }} />
              Quick Run
            </span>
            {PRESET_PROMPTS.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => { setPrompt(item.prompt); handleRunAgent(item.prompt); }}
                  disabled={isRunning}
                  className={`flex items-center gap-2 border rounded-full font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${item.color}`}
                  style={{ padding: "8px 16px", fontSize: "12px", cursor: isRunning ? "not-allowed" : "pointer", opacity: isRunning ? 0.5 : 1 }}
                >
                  <Icon style={{ width: "13px", height: "13px" }} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Console Card */}
          <div style={{
            flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
            borderRadius: "20px", overflow: "hidden",
            border: "1.5px solid rgba(255,255,255,0.1)",
            background: "rgba(10,10,15,0.8)",
            boxShadow: "0 16px 48px -12px rgba(0,0,0,0.5)",
          }}>
            {/* Console Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 24px",
              background: "rgba(255,255,255,0.04)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Terminal style={{ width: "15px", height: "15px", color: "#a78bfa" }} />
                <span style={{ fontSize: "12px", fontWeight: "700", color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-code)", letterSpacing: "0.3px" }}>
                  Agent Execution Stream
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <Activity style={{ width: "13px", height: "13px", color: "#34d399" }} />
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#34d399", fontFamily: "var(--font-code)" }}>
                    {(tokenUsage / 1000).toFixed(1)}k / 128k tokens
                  </span>
                </div>
                <button
                  onClick={() => setLogs([])}
                  style={{ padding: "6px", borderRadius: "8px", background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex" }}
                  title="Clear"
                >
                  <RefreshCw style={{ width: "13px", height: "13px" }} />
                </button>
              </div>
            </div>

            {/* Log stream */}
            <div ref={logConsoleRef} style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {logs.map(log => {
                const s = logStyle[log.type];
                return (
                  <div key={log.id} className={s.wrap} style={{ borderRadius: "14px", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {s.icon}
                        <span className={`font-mono font-bold text-sm ${s.title}`}>{log.title}</span>
                      </div>
                      <span style={{
                        fontSize: "10px", fontFamily: "var(--font-code)", fontWeight: "600",
                        padding: "4px 10px", borderRadius: "6px",
                        background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}>{log.timestamp}</span>
                    </div>
                    <p className={`text-sm leading-relaxed ${s.body}`} style={{ margin: 0, paddingLeft: "28px" }}>{log.content}</p>
                    {log.codeSnippet && (
                      <pre style={{
                        margin: "4px 0 0 28px", padding: "16px 18px", borderRadius: "12px",
                        background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)",
                        fontSize: "11px", fontFamily: "var(--font-code)", color: "#94a3b8",
                        overflowX: "auto", lineHeight: "1.7",
                      }}>
                        <code>{log.codeSnippet}</code>
                      </pre>
                    )}
                  </div>
                );
              })}
              {isRunning && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "16px 20px", borderRadius: "14px",
                  background: "rgba(88,28,255,0.08)", border: "1px solid rgba(139,92,246,0.3)",
                }}>
                  <RefreshCw style={{ width: "16px", height: "16px", color: "#a78bfa", animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: "13px", color: "#c4b5fd", fontWeight: "600" }}>Analyzing AST graphs and generating recommendations…</span>
                </div>
              )}
            </div>

            {/* Prompt input */}
            <div style={{
              padding: "16px 20px",
              background: "rgba(255,255,255,0.03)",
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}>
              <form onSubmit={e => { e.preventDefault(); handleRunAgent(); }} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    type="text"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Instruct the agent… (e.g. 'Find memory leaks & optimize imports')"
                    disabled={isRunning}
                    style={{
                      width: "100%", height: "50px",
                      padding: "0 48px 0 18px",
                      borderRadius: "14px", fontSize: "13px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1.5px solid rgba(255,255,255,0.12)",
                      color: "var(--foreground)", outline: "none",
                      fontFamily: "var(--font-code)",
                      boxSizing: "border-box",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={e => (e.target.style.borderColor = "rgba(139,92,246,0.7)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                  />
                  <Sparkles style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "rgba(139,92,246,0.5)", pointerEvents: "none" }} />
                </div>
                <button
                  type="submit"
                  disabled={isRunning || !prompt.trim()}
                  style={{
                    height: "50px", padding: "0 28px",
                    borderRadius: "14px", border: "none", cursor: isRunning || !prompt.trim() ? "not-allowed" : "pointer",
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5, #2563eb)",
                    color: "white", fontSize: "13px", fontWeight: "700",
                    display: "flex", alignItems: "center", gap: "8px",
                    boxShadow: "0 8px 20px -4px rgba(124,58,237,0.4)",
                    opacity: isRunning || !prompt.trim() ? 0.6 : 1,
                    transition: "opacity 0.2s, transform 0.1s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isRunning ? <><Square style={{ width: "14px", height: "14px" }} /> Stop</> : <><Play style={{ width: "14px", height: "14px" }} /> Run Agent</>}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right — Subagents + Permissions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", minHeight: 0 }}>

          {/* Subagent Team Card */}
          <div style={{
            borderRadius: "20px", overflow: "hidden",
            border: "1.5px solid rgba(255,255,255,0.1)",
            background: "rgba(18,18,24,0.9)",
            boxShadow: "0 8px 32px -8px rgba(0,0,0,0.4)",
          }}>
            {/* Card header */}
            <div style={{
              padding: "18px 24px",
              background: "rgba(255,255,255,0.03)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Layers style={{ width: "16px", height: "16px", color: "#a78bfa" }} />
                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--foreground)" }}>Active Subagent Team</span>
              </div>
              <span style={{ fontSize: "10px", fontWeight: "700", padding: "4px 10px", borderRadius: "6px", background: "rgba(139,92,246,0.15)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                3 Agents
              </span>
            </div>

            {/* Subagents list */}
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {subagents.map(sa => {
                const s = statusStyle[sa.status];
                return (
                  <div key={sa.id} style={{
                    padding: "16px 18px", borderRadius: "14px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", flexDirection: "column", gap: "10px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--foreground)" }}>{sa.name}</span>
                      <span className={s.badge} style={{ fontSize: "10px", fontWeight: "700", padding: "3px 10px", borderRadius: "6px", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%" }} className={s.dot} />
                        {sa.status}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--muted-foreground)", lineHeight: "1.4" }}>{sa.role}</p>
                    <div style={{ borderRadius: "99px", height: "5px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div style={{
                        height: "5px", borderRadius: "99px", width: `${sa.progress}%`,
                        background: "linear-gradient(90deg, #7c3aed, #3b82f6)",
                        transition: "width 0.5s ease",
                        boxShadow: sa.progress > 0 ? "0 0 8px rgba(124,58,237,0.5)" : "none",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent Tools & Permissions Card */}
          <div style={{
            flex: 1, borderRadius: "20px", overflow: "hidden",
            border: "1.5px solid rgba(255,255,255,0.1)",
            background: "rgba(18,18,24,0.9)",
            boxShadow: "0 8px 32px -8px rgba(0,0,0,0.4)",
          }}>
            {/* Card header */}
            <div style={{
              padding: "18px 24px",
              background: "rgba(255,255,255,0.03)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", gap: "10px",
            }}>
              <Sliders style={{ width: "16px", height: "16px", color: "#60a5fa" }} />
              <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--foreground)" }}>Tools & Permissions</span>
            </div>

            {/* Permissions list */}
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {CAPABILITIES.map(cap => (
                <label
                  key={cap.key}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 18px", borderRadius: "14px",
                    background: caps[cap.key] ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${caps[cap.key] ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span className={`text-sm font-bold ${cap.color}`}>{cap.label}</span>
                    <span style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: "1.3" }}>{cap.description}</span>
                  </div>
                  <div
                    onClick={() => setCaps(prev => ({ ...prev, [cap.key]: !prev[cap.key] }))}
                    style={{
                      width: "40px", height: "22px", borderRadius: "99px",
                      background: caps[cap.key] ? "linear-gradient(135deg, #7c3aed, #3b82f6)" : "rgba(255,255,255,0.1)",
                      position: "relative", cursor: "pointer", transition: "background 0.2s",
                      boxShadow: caps[cap.key] ? "0 0 10px rgba(124,58,237,0.4)" : "none",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: "absolute", top: "3px",
                      left: caps[cap.key] ? "21px" : "3px",
                      width: "16px", height: "16px", borderRadius: "50%",
                      background: "white", transition: "left 0.2s",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                    }} />
                  </div>
                </label>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

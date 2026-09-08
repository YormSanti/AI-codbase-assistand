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
  PlusCircle,
} from "lucide-react";
import type { RepositoryInfo } from "../types/domain";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AIThreadStartHero } from "./AIThreadStartHero";

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

interface ProviderStatus {
  installed: boolean;
  authenticated: boolean;
}

interface AgentResponse {
  content: string;
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  provider: Provider;
}

type Provider = "codex" | "gemini";
type ConnectionState = "checking" | "disconnected" | "connecting" | "connected" | "error";

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

export function AIAgentPage({
  repository,
  initialPrompt,
  onInitialPromptConsumed,
}: {
  repository?: RepositoryInfo | null;
  initialPrompt?: string | null;
  onInitialPromptConsumed?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [isRunning, setIsRunning] = useState(false);
  const [viewMode, setViewMode] = useState<"start" | "chat">("start");
  const [providerStatuses, setProviderStatuses] = useState<Record<Provider, ConnectionState>>({
    codex: "checking",
    gemini: "checking",
  });
  const [connectionError, setConnectionError] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [tokenUsage, setTokenUsage] = useState(0);
  const [logs, setLogs] = useState<AgentLog[]>([]);

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

  useEffect(() => {
    if (!initialPrompt || viewMode === "start") return;
    setPrompt(initialPrompt);
    onInitialPromptConsumed?.();
  }, [initialPrompt, onInitialPromptConsumed, viewMode]);

  useEffect(() => {
    let active = true;

    const checkProviderLogins = async () => {
      if (!("__TAURI_INTERNALS__" in window)) {
        if (active) setProviderStatuses({ codex: "disconnected", gemini: "disconnected" });
        return;
      }

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const [codex, gemini] = await Promise.all([
          invoke<ProviderStatus>("codex_login_status"),
          invoke<ProviderStatus>("gemini_login_status"),
        ]);
        if (!active) return;
        setProviderStatuses({
          codex: codex.authenticated ? "connected" : "disconnected",
          gemini: gemini.authenticated ? "connected" : "disconnected",
        });
      } catch (error) {
        if (!active) return;
        setProviderStatuses({ codex: "error", gemini: "error" });
        setConnectionError(error instanceof Error ? error.message : String(error));
      }
    };

    void checkProviderLogins();
    return () => {
      active = false;
    };
  }, []);

  const activeStatus = providerStatuses[provider];
  const providerName = provider === "codex" ? "Codex" : "Gemini";

  const updateProviderStatus = (target: Provider, status: ConnectionState) => {
    setProviderStatuses(previous => ({ ...previous, [target]: status }));
  };

  const handleConnectProvider = async () => {
    if (activeStatus === "connecting") return;
    if (!("__TAURI_INTERNALS__" in window)) {
      updateProviderStatus(provider, "error");
      setConnectionError(`Open DevPilot as a desktop app to connect with ${providerName}.`);
      return;
    }

    updateProviderStatus(provider, "connecting");
    setConnectionError("");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke(`connect_${provider}`);
      const status = await invoke<ProviderStatus>(`${provider}_login_status`);
      if (!status.authenticated) {
        throw new Error(`${providerName} did not report an authenticated session.`);
      }
      updateProviderStatus(provider, "connected");
    } catch (error) {
      updateProviderStatus(provider, "error");
      setConnectionError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleRunAgent = async (customPrompt?: string) => {
    const targetPrompt = customPrompt || prompt;
    if (!targetPrompt.trim() || isRunning) return;

    setViewMode("chat");
    const currentProvider = provider;
    const currentProviderName = providerName;
    const priorConversation = chatHistory
      .filter(turn => turn.provider === currentProvider)
      .slice(-8)
      .map(turn => `${turn.role === "user" ? "User" : currentProviderName}: ${turn.content}`)
      .join("\n\n");
    const agentPrompt = priorConversation
      ? `Continue this conversation about the current repository.\n\n${priorConversation}\n\nUser: ${targetPrompt}\n\nRespond to the latest user message.`
      : targetPrompt;

    setIsRunning(true);
    setConnectionError("");
    setPrompt("");
    setSubagents(prev => prev.map((sa, idx) => idx === 1 ? { ...sa, status: "running", progress: 45 } : sa));
    const nowStr = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs(prev => [...prev, { id: crypto.randomUUID(), timestamp: nowStr, type: "thought", title: "You", content: targetPrompt }]);

    try {
      if (!("__TAURI_INTERNALS__" in window)) {
        // Mock intelligent response in web preview mode
        await new Promise(res => setTimeout(res, 1200));
        const mockResponse = `I've analyzed the codebase for "${repository?.name || "pharmacy-mobile-v2"}".\n\n- Tracked AST symbols: Classes and methods indexed\n- File changes synthesized respecting .gitignore\n- Task completed in local workspace.`;

        setLogs(prev => [...prev, {
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          type: "result",
          title: `${currentProviderName} response`,
          content: mockResponse,
        }]);
        setChatHistory(prev => [
          ...prev,
          { role: "user", content: targetPrompt, provider: currentProvider },
          { role: "assistant", content: mockResponse, provider: currentProvider },
        ]);
        setTokenUsage(prev => prev + Math.ceil((targetPrompt.length + mockResponse.length) / 4));
        setSubagents(prev => prev.map(sa => ({ ...sa, status: "completed", progress: 100 })));
        return;
      }

      const { invoke } = await import("@tauri-apps/api/core");
      const response = await invoke<AgentResponse>("run_agent", {
        request: {
          provider: currentProvider,
          prompt: agentPrompt,
          workingDirectory: repository?.root_path ?? null,
        },
      });

      setLogs(prev => [...prev, {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        type: "result",
        title: `${currentProviderName} response`,
        content: response.content,
      }]);
      setChatHistory(prev => [
        ...prev,
        { role: "user", content: targetPrompt, provider: currentProvider },
        { role: "assistant", content: response.content, provider: currentProvider },
      ]);
      setTokenUsage(prev => prev + Math.ceil((targetPrompt.length + response.content.length) / 4));
      setSubagents(prev => prev.map(sa => ({ ...sa, status: "completed", progress: 100 })));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLogs(prev => [...prev, {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        type: "warning",
        title: `${currentProviderName} error`,
        content: message,
      }]);
      setSubagents(prev => prev.map(sa => sa.status === "running" ? { ...sa, status: "idle", progress: 0 } : sa));
    } finally {
      setIsRunning(false);
    }
  };

  const handleHeroSubmit = (heroPrompt: string, _selectedModel: string, _thinking: string) => {
    void handleRunAgent(heroPrompt);
  };

  const handleResetThread = () => {
    setLogs([]);
    setChatHistory([]);
    setTokenUsage(0);
    setViewMode("start");
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

  // If in start mode and no active turns
  if (viewMode === "start" && chatHistory.length === 0) {
    return (
      <div className="w-full h-full flex flex-col bg-[#080c14] overflow-y-auto">
        <AIThreadStartHero
          repository={repository}
          onSubmitPrompt={handleHeroSubmit}
          isLoading={isRunning}
          initialPrompt={initialPrompt}
          onInitialPromptConsumed={onInitialPromptConsumed}
        />
      </div>
    );
  }

  return (
    <div className="ai-agent-page" style={{ display: "flex", flexDirection: "column", gap: "18px", width: "100%", height: "100%", minHeight: 0, overflow: "hidden", padding: "18px 20px" }}>

      {/* ── Top Controls Header ───────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "14px",
        padding: "16px 24px", borderRadius: "18px",
        background: "linear-gradient(135deg, rgba(88,28,255,0.12) 0%, rgba(37,99,235,0.08) 100%)",
        border: "1.5px solid rgba(139,92,246,0.35)",
        boxShadow: "0 8px 32px -8px rgba(88,28,255,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            padding: "10px", borderRadius: "14px",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5, #2563eb)",
            boxShadow: "0 6px 18px -3px rgba(124,58,237,0.5)",
          }}>
            <Bot style={{ width: "24px", height: "24px", color: "white" }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--foreground)", letterSpacing: "-0.5px", margin: 0 }}>
                AI Agent Studio
              </h2>
              <span style={{
                fontSize: "10px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase",
                padding: "2px 8px", borderRadius: "6px",
                background: "rgba(139,92,246,0.2)", color: "#c4b5fd",
                border: "1px solid rgba(139,92,246,0.4)",
              }}>
                {repository?.name || "pharmacy-mobile-v2"}
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--muted-foreground)", margin: "2px 0 0 0" }}>
              Local agentic execution with AST tools and automatic code patches
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleResetThread}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-zinc-300"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Thread</span>
          </button>

          <button
            onClick={() => void handleConnectProvider()}
            disabled={activeStatus === "connecting" || activeStatus === "checking"}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 14px", borderRadius: "12px",
              background: "rgba(139,92,246,0.15)", border: "1.5px solid rgba(139,92,246,0.4)",
              color: "#c4b5fd", fontSize: "12px", fontWeight: "700",
              cursor: activeStatus === "connecting" || activeStatus === "checking" ? "wait" : "pointer",
            }}
          >
            {activeStatus === "connecting" ? (
              <RefreshCw className="animate-spin" style={{ width: "13px", height: "13px" }} />
            ) : (
              <Zap style={{ width: "13px", height: "13px" }} />
            )}
            {activeStatus === "connecting" ? "Connecting…" : activeStatus === "connected" ? `${providerName} Ready` : `Connect ${providerName}`}
          </button>

          <Select
            value={provider}
            onValueChange={value => {
              setProvider(value as Provider);
              setConnectionError("");
            }}
          >
            <SelectTrigger className="h-[38px] w-[170px] rounded-xl border-border bg-secondary px-3 font-mono text-xs text-foreground shadow-none">
              <SelectValue placeholder="Choose provider" />
            </SelectTrigger>
            <SelectContent position="popper" align="end" className="min-w-[170px] rounded-xl border-border bg-popover text-popover-foreground">
              <SelectItem value="codex" className="rounded-lg font-mono text-xs">OpenAI Codex</SelectItem>
              <SelectItem value="gemini" className="rounded-lg font-mono text-xs">Google Gemini</SelectItem>
            </SelectContent>
          </Select>

          {connectionError && (
            <div className="w-full text-right text-xs text-rose-400 font-medium">
              {connectionError}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="ai-agent-body" style={{ flex: 1, display: "grid", gap: "18px", minHeight: 0, overflow: "hidden" }}>

        {/* Left — Stream Console */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", minHeight: 0 }}>

          {/* Preset chips */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              <Sparkles style={{ width: "13px", height: "13px", color: "#f59e0b" }} />
              Quick Run
            </span>
            {PRESET_PROMPTS.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => { setPrompt(item.prompt); void handleRunAgent(item.prompt); }}
                  disabled={isRunning}
                  className={`flex items-center gap-1.5 border rounded-full font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${item.color}`}
                  style={{ padding: "6px 14px", fontSize: "11.5px", cursor: isRunning ? "not-allowed" : "pointer", opacity: isRunning ? 0.5 : 1 }}
                >
                  <Icon style={{ width: "12px", height: "12px" }} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Console Card */}
          <div style={{
            flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
            borderRadius: "18px", overflow: "hidden",
            border: "1.5px solid rgba(255,255,255,0.1)",
            background: "rgba(10,10,15,0.8)",
            boxShadow: "0 16px 48px -12px rgba(0,0,0,0.5)",
          }}>
            {/* Console Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 20px",
              background: "rgba(255,255,255,0.04)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Terminal style={{ width: "14px", height: "14px", color: "#a78bfa" }} />
                <span style={{ fontSize: "12px", fontWeight: "700", color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-code)" }}>
                  Agent Execution Stream
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Activity style={{ width: "12px", height: "12px", color: "#34d399" }} />
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#34d399", fontFamily: "var(--font-code)" }}>
                    {(tokenUsage / 1000).toFixed(1)}k / 128k tokens
                  </span>
                </div>
                <button
                  onClick={() => {
                    setLogs([]);
                    setChatHistory([]);
                    setTokenUsage(0);
                  }}
                  style={{ padding: "4px", borderRadius: "6px", background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex" }}
                  title="Clear"
                >
                  <RefreshCw style={{ width: "12px", height: "12px" }} />
                </button>
              </div>
            </div>

            {/* Log stream */}
            <div ref={logConsoleRef} style={{ flex: 1, overflowY: "auto", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {logs.map(log => {
                const s = logStyle[log.type];
                return (
                  <div key={log.id} className={s.wrap} style={{ borderRadius: "14px", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {s.icon}
                        <span className={`font-mono font-bold text-xs ${s.title}`}>{log.title}</span>
                      </div>
                      <span style={{
                        fontSize: "10px", fontFamily: "var(--font-code)", fontWeight: "600",
                        padding: "3px 8px", borderRadius: "6px",
                        background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}>{log.timestamp}</span>
                    </div>
                    <p className={`text-xs leading-relaxed ${s.body}`} style={{ margin: 0, paddingLeft: "24px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{log.content}</p>
                  </div>
                );
              })}
              {isRunning && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "14px 18px", borderRadius: "12px",
                  background: "rgba(88,28,255,0.08)", border: "1px solid rgba(139,92,246,0.3)",
                }}>
                  <RefreshCw style={{ width: "15px", height: "15px", color: "#a78bfa", animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: "12.5px", color: "#c4b5fd", fontWeight: "600" }}>{providerName} is analyzing and coding…</span>
                </div>
              )}
            </div>

            {/* Prompt input */}
            <div style={{
              padding: "14px 18px",
              background: "rgba(255,255,255,0.03)",
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}>
              <form onSubmit={e => { e.preventDefault(); void handleRunAgent(); }} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    type="text"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder={`Ask for a change, bug fix, or file in ${repository?.name || "pharmacy-mobile-v2"}...`}
                    disabled={isRunning}
                    style={{
                      width: "100%", height: "46px",
                      padding: "0 44px 0 16px",
                      borderRadius: "12px", fontSize: "13px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1.5px solid rgba(255,255,255,0.12)",
                      color: "var(--foreground)", outline: "none",
                      fontFamily: "var(--font-code)",
                      boxSizing: "border-box",
                    }}
                  />
                  <Sparkles style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", width: "15px", height: "15px", color: "rgba(139,92,246,0.5)", pointerEvents: "none" }} />
                </div>
                <button
                  type="submit"
                  disabled={isRunning || !prompt.trim()}
                  style={{
                    height: "46px", padding: "0 22px",
                    borderRadius: "12px", border: "none", cursor: isRunning || !prompt.trim() ? "not-allowed" : "pointer",
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5, #2563eb)",
                    color: "white", fontSize: "12.5px", fontWeight: "700",
                    display: "flex", alignItems: "center", gap: "6px",
                    boxShadow: "0 8px 20px -4px rgba(124,58,237,0.4)",
                    opacity: isRunning || !prompt.trim() ? 0.6 : 1,
                  }}
                >
                  {isRunning ? <><Square style={{ width: "13px", height: "13px" }} /> Thinking</> : <><Play style={{ width: "13px", height: "13px" }} /> Send</>}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right — Subagents + Permissions */}
        <div className="ai-agent-sidebar" style={{ display: "flex", flexDirection: "column", gap: "18px", minHeight: 0, overflow: "hidden" }}>

          {/* Subagent Team Card */}
          <div style={{
            borderRadius: "18px", overflow: "hidden",
            border: "1.5px solid rgba(255,255,255,0.1)",
            background: "rgba(18,18,24,0.9)",
            boxShadow: "0 8px 32px -8px rgba(0,0,0,0.4)",
          }}>
            <div style={{
              padding: "16px 20px",
              background: "rgba(255,255,255,0.03)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Layers style={{ width: "15px", height: "15px", color: "#a78bfa" }} />
                <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--foreground)" }}>Active Subagent Team</span>
              </div>
              <span style={{ fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "6px", background: "rgba(139,92,246,0.15)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" }}>
                3 Agents
              </span>
            </div>

            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {subagents.map(sa => {
                const s = statusStyle[sa.status];
                return (
                  <div key={sa.id} style={{
                    padding: "14px 16px", borderRadius: "12px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", flexDirection: "column", gap: "8px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--foreground)" }}>{sa.name}</span>
                      <span className={s.badge} style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%" }} className={s.dot} />
                        {sa.status}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted-foreground)" }}>{sa.role}</p>
                    <div style={{ borderRadius: "99px", height: "4px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div style={{
                        height: "4px", borderRadius: "99px", width: `${sa.progress}%`,
                        background: "linear-gradient(90deg, #7c3aed, #3b82f6)",
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent Tools & Permissions Card */}
          <div style={{
            flex: 1, minHeight: 0, borderRadius: "18px", overflow: "hidden",
            display: "flex", flexDirection: "column",
            border: "1.5px solid rgba(255,255,255,0.1)",
            background: "rgba(18,18,24,0.9)",
            boxShadow: "0 8px 32px -8px rgba(0,0,0,0.4)",
          }}>
            <div style={{
              padding: "16px 20px",
              background: "rgba(255,255,255,0.03)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <Sliders style={{ width: "15px", height: "15px", color: "#60a5fa" }} />
              <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--foreground)" }}>Tools & Permissions</span>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {CAPABILITIES.map(cap => (
                <label
                  key={cap.key}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", borderRadius: "12px",
                    background: caps[cap.key] ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${caps[cap.key] ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span className={`text-xs font-bold ${cap.color}`}>{cap.label}</span>
                    <span style={{ fontSize: "10.5px", color: "var(--muted-foreground)" }}>{cap.description}</span>
                  </div>
                  <div
                    onClick={() => setCaps(prev => ({ ...prev, [cap.key]: !prev[cap.key] }))}
                    style={{
                      width: "36px", height: "20px", borderRadius: "99px",
                      background: caps[cap.key] ? "linear-gradient(135deg, #7c3aed, #3b82f6)" : "rgba(255,255,255,0.1)",
                      position: "relative", cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: "absolute", top: "2px",
                      left: caps[cap.key] ? "18px" : "2px",
                      width: "16px", height: "16px", borderRadius: "50%",
                      background: "white", transition: "left 0.2s",
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

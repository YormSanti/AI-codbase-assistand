import { useEffect, useState } from "react";
import { Bot, FolderOpen, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import type { RepositoryInfo } from "../types/domain";
import { AIThreadStartHero } from "./AIThreadStartHero";
import { useAppSettings } from "../hooks/useAppSettings";
import { describeProvider, getProviderStatuses, PROVIDER_NAMES, type ProviderId, type ProviderStatus } from "../lib/providers";
import { buildConversationPrompt, MAX_AGENT_PROMPT_CHARS, runAgent } from "../lib/agent";
import { conversationStorageKey, loadConversation, saveConversation } from "../lib/conversations";

interface AgentLog {
  id: string;
  timestamp: string;
  type: "thought" | "result" | "warning";
  title: string;
  content: string;
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  provider: ProviderId;
}


function nowLabel() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function toneClass(tone: "ok" | "warn" | "muted") {
  return tone === "ok"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : tone === "warn"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-border bg-muted text-muted-foreground";
}

export function AIAgentPage({
  repository,
  initialPrompt,
  onInitialPromptConsumed,
  threadId,
  onFirstMessage,
}: {
  repository?: RepositoryInfo | null;
  initialPrompt?: string | null;
  onInitialPromptConsumed?: () => void;
  /** Persist this conversation under the project and thread; remount the page when either changes. */
  threadId?: string;
  /** Called with the first message sent in an empty conversation (used to title the thread). */
  onFirstMessage?: (prompt: string) => void;
}) {
  const { settings } = useAppSettings();
  const isDesktop = "__TAURI_INTERNALS__" in window;
  const [provider, setProvider] = useState<ProviderId>(settings.defaultProvider);
  const [isRunning, setIsRunning] = useState(false);
  const [statuses, setStatuses] = useState<Record<ProviderId, ProviderStatus> | null | "checking">("checking");
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const storageKey = threadId ? conversationStorageKey(repository?.id ?? "none", threadId) : null;
  const [restored] = useState(() => loadConversation(storageKey));
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>(restored.chatHistory);
  const [logs, setLogs] = useState<AgentLog[]>(restored.logs);

  // Save after each completed exchange rather than on every streamed chunk.
  useEffect(() => {
    if (storageKey && !isRunning) saveConversation(storageKey, { logs, chatHistory });
  }, [storageKey, isRunning, logs, chatHistory]);

  const refreshStatuses = async () => {
    try {
      setStatuses(await getProviderStatuses());
    } catch (error) {
      setStatuses(null);
      setConnectionError(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    let active = true;
    getProviderStatuses()
      .then(result => { if (active) setStatuses(result); })
      .catch(error => {
        if (!active) return;
        setStatuses(null);
        setConnectionError(error instanceof Error ? error.message : String(error));
      });
    return () => { active = false; };
  }, []);

  const activeStatus = statuses === "checking" || statuses === null ? undefined : statuses[provider];
  const providerName = PROVIDER_NAMES[provider];

  const handleConnectProvider = async () => {
    if (connecting || !isDesktop) return;
    setConnecting(true);
    setConnectionError("");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke(`connect_${provider}`);
      const status = await invoke<ProviderStatus>(`${provider}_login_status`);
      if (!status.authenticated) throw new Error(`${providerName} did not report an authenticated session.`);
      await refreshStatuses();
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
    } finally {
      setConnecting(false);
    }
  };

  const appendLog = (entry: Omit<AgentLog, "id" | "timestamp">) =>
    setLogs(previous => [...previous, { id: crypto.randomUUID(), timestamp: nowLabel(), ...entry }]);

  const handleRunAgent = async (targetPrompt: string, providerOverride?: ProviderId) => {
    if (!targetPrompt.trim() || isRunning) return;
    const currentProvider = providerOverride ?? provider;
    const currentProviderName = PROVIDER_NAMES[currentProvider];
    if (providerOverride) setProvider(providerOverride);

    if (!logs.some(log => log.title === "You")) onFirstMessage?.(targetPrompt);
    appendLog({ type: "thought", title: "You", content: targetPrompt });

    if (targetPrompt.length > MAX_AGENT_PROMPT_CHARS) {
      appendLog({ type: "warning", title: "Message too long", content: `This message has ${targetPrompt.length.toLocaleString("en-US")} characters. Keep it under ${MAX_AGENT_PROMPT_CHARS.toLocaleString("en-US")} so the CLI accepts it.` });
      return;
    }

    // The CLIs are stateless: replay the newest turns with this provider that fit the prompt budget.
    const agentPrompt = buildConversationPrompt(
      chatHistory.filter(turn => turn.provider === currentProvider),
      targetPrompt,
      currentProviderName,
    );

    setIsRunning(true);
    setConnectionError("");

    try {
      // A live log entry receives streamed chunks until the process exits.
      const logId = crypto.randomUUID();
      setLogs(previous => [...previous, { id: logId, timestamp: nowLabel(), type: "result", title: `${currentProviderName} response`, content: "" }]);

      const content = await runAgent({
        provider: currentProvider,
        prompt: agentPrompt,
        workingDirectory: repository?.root_path ?? null,
        repositoryId: repository?.id ?? null,
        onChunk: chunk => {
          if (!settings.streamOutput) return;
          setLogs(previous => previous.map(log => log.id === logId ? { ...log, content: log.content + chunk } : log));
        },
      });

      setLogs(previous => previous.map(log => log.id === logId ? { ...log, content } : log));
      setChatHistory(previous => [
        ...previous,
        { role: "user", content: targetPrompt, provider: currentProvider },
        { role: "assistant", content, provider: currentProvider },
      ]);
    } catch (error) {
      appendLog({ type: "warning", title: `${currentProviderName} error`, content: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRunning(false);
    }
  };

  const handleHeroSubmit = (heroPrompt: string, selectedModel: string) => {
    void handleRunAgent(heroPrompt, selectedModel === "Codex" ? "codex" : "gemini");
  };

  const handleResetThread = () => {
    setLogs([]);
    setChatHistory([]);
  };

  const turns = chatHistory.filter(turn => turn.role === "user").length;

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-2 text-xs" aria-label="AI session">
        <span className="flex items-center gap-2 font-semibold"><Bot size={14} className="text-primary" />AI Assistant</span>
        <span className="flex items-center gap-1.5 text-muted-foreground" title={repository?.root_path}>
          <FolderOpen size={13} />{repository ? repository.name : "No project open"}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground" title="Codex runs with a read-only sandbox and Gemini in non-interactive prompt mode; neither modifies files.">
          <ShieldCheck size={13} />Read-only access
        </span>
        {turns > 0 && <span className="text-muted-foreground">{turns} {turns === 1 ? "turn" : "turns"}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(["codex", "gemini"] as ProviderId[]).map(id => {
            const described = statuses === "checking" ? { label: "Checking…", tone: "muted" as const } : describeProvider(statuses?.[id]);
            return (
              <button key={id} type="button" aria-pressed={provider === id} onClick={() => setProvider(id)} title={`Use ${PROVIDER_NAMES[id]}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition-colors ${toneClass(described.tone)} ${provider === id ? "ring-2 ring-ring/40" : ""}`}>
                {PROVIDER_NAMES[id]}<span className="opacity-70">· {described.label}</span>
              </button>
            );
          })}
          {isDesktop && activeStatus && !activeStatus.authenticated && (
            <button type="button" onClick={() => void handleConnectProvider()} disabled={connecting}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground disabled:opacity-60">
              {connecting ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
              {connecting ? "Connecting…" : activeStatus.installed ? `Connect ${providerName}` : `Install ${providerName}`}
            </button>
          )}
          {!isDesktop && activeStatus && !activeStatus.authenticated && (
            <span className="text-muted-foreground">
              {activeStatus.installed ? `Sign in by running \`${provider} login\` on the Terminal page.` : `Install the ${providerName} CLI to use it.`}
            </span>
          )}
          {statuses !== "checking" && (
            <button type="button" aria-label="Refresh provider status" title="Refresh provider status" onClick={() => void refreshStatuses()} className="rounded-full p-1 text-muted-foreground hover:bg-accent">
              <RefreshCw size={13} />
            </button>
          )}
        </div>
        {connectionError && <p role="alert" className="w-full text-destructive">{connectionError}</p>}
      </header>

      <AIThreadStartHero
        repository={repository}
        onSubmitPrompt={handleHeroSubmit}
        onModelChange={model => setProvider(model === "Codex" ? "codex" : "gemini")}
        isLoading={isRunning}
        initialPrompt={initialPrompt}
        onInitialPromptConsumed={onInitialPromptConsumed}
        messages={logs}
        onResetThread={handleResetThread}
      />
    </div>
  );
}

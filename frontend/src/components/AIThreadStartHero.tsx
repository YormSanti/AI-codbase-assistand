import { useEffect, useRef, useState } from "react";
import {
  Bug,
  ChevronDown,
  FileSearch,
  Folder,
  GitBranch,
  LoaderCircle,
  Send,
  ShieldCheck,
  Sparkles,
  TestTube2,
} from "lucide-react";
import type { RepositoryInfo } from "@/types/domain";

interface AIThreadStartHeroProps {
  repository?: RepositoryInfo | null;
  onSubmitPrompt: (prompt: string, model: string, thinkingLevel: string) => void;
  isLoading?: boolean;
  initialPrompt?: string | null;
  onInitialPromptConsumed?: () => void;
  messages?: { id: string; title: string; content: string; type: string }[];
}

const STARTERS = [
  {
    label: "Review this project",
    description: "Find the highest-impact improvements",
    icon: FileSearch,
    prompt: "Review this repository and recommend the three highest-impact improvements, with specific files and reasons.",
  },
  {
    label: "Find likely bugs",
    description: "Audit risky paths and edge cases",
    icon: Bug,
    prompt: "Audit this repository for likely bugs and edge cases. Prioritize findings by severity and include exact file references.",
  },
  {
    label: "Run the tests",
    description: "Diagnose failures and suggest fixes",
    icon: TestTube2,
    prompt: "Run the relevant test suites, diagnose any failures, and propose focused fixes without changing unrelated code.",
  },
] as const;

export function AIThreadStartHero({
  repository,
  onSubmitPrompt,
  isLoading = false,
  initialPrompt,
  onInitialPromptConsumed,
  messages = [],
}: AIThreadStartHeroProps) {
  const conversationEnd = useRef<HTMLDivElement>(null);
  const hasMessages = messages.length > 0;
  useEffect(() => {
    conversationEnd.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [messages, isLoading]);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("Gemini");
  const [thinkingLevel, setThinkingLevel] = useState("High");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showThinkingDropdown, setShowThinkingDropdown] = useState(false);

  useEffect(() => {
    if (!initialPrompt) return;
    setPrompt(initialPrompt);
    onInitialPromptConsumed?.();
  }, [initialPrompt, onInitialPromptConsumed]);

  const projectName = repository?.name ?? "No project selected";
  const branch = repository?.current_branch ?? "No branch";

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isLoading || !repository) return;
    onSubmitPrompt(trimmed, model, thinkingLevel);
    setPrompt("");
  };

  return (
    <main
      className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden bg-background px-5 py-10 sm:px-8"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 25%, rgba(124,58,237,0.11), transparent 32%), radial-gradient(circle at 75% 75%, rgba(37,99,235,0.06), transparent 28%)",
      }}
    >
      <div className="relative z-10 flex w-full max-w-[780px] flex-col items-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-violet-400/20 bg-black shadow-[0_14px_45px_-16px_rgba(139,92,246,0.8)]">
          <img src="/logo.png" alt="IFROG" className="h-full w-full object-cover" />
        </div>

        <div className="mb-8 text-center" hidden={hasMessages}>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1 text-[11px] font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {repository ? "Repository connected" : "Choose a repository to begin"}
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
            What should we build in{" "}
            <span className="bg-gradient-to-r from-violet-300 to-blue-300 bg-clip-text text-transparent">
              {projectName}
            </span>
            ?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Ask IFROG to inspect code, explain behavior, diagnose a failure, or plan a focused change.
          </p>
        </div>

        {hasMessages && (
          <section aria-label="Conversation" role="log" aria-live="polite" className="mb-5 max-h-[50vh] w-full space-y-4 overflow-y-auto pr-2">
            {messages.map((message) => (
              <article key={message.id} className={`rounded-xl border p-4 ${message.type === "warning" ? "border-rose-500/30 bg-rose-500/5" : message.title === "You" ? "ml-8 border-violet-500/20 bg-violet-500/10" : "mr-8 border-border bg-card"}`}>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">{message.title}</p>
                <div className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{message.content}</div>
              </article>
            ))}
            {isLoading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Waiting for a reply…</p>}
            <div ref={conversationEnd} />
          </section>
        )}
        <form
          onSubmit={handleSubmit}
          className="w-full overflow-visible rounded-2xl border border-border bg-card/95 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.9)] transition-colors focus-within:border-violet-500/50"
        >
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={repository ? "Ask about your codebase…" : "Open a repository before starting a thread"}
            disabled={!repository || isLoading}
            rows={4}
            autoFocus
            className="block min-h-28 w-full resize-none bg-transparent px-5 py-4 text-[14px] leading-6 text-foreground outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-60"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/25 px-3 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowModelDropdown((visible) => !visible);
                    setShowThinkingDropdown(false);
                  }}
                  className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 text-xs font-medium text-foreground hover:bg-accent"
                  aria-expanded={showModelDropdown}
                >
                  <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  {model}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
                {showModelDropdown && (
                  <div className="absolute bottom-full left-0 z-30 mb-2 w-40 rounded-xl border border-border bg-popover p-1.5 shadow-2xl">
                    {["Gemini", "Codex"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setModel(option);
                          setShowModelDropdown(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-accent ${model === option ? "text-violet-300" : "text-popover-foreground"}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowThinkingDropdown((visible) => !visible);
                    setShowModelDropdown(false);
                  }}
                  className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 text-xs font-medium text-foreground hover:bg-accent"
                  aria-expanded={showThinkingDropdown}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  {thinkingLevel}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
                {showThinkingDropdown && (
                  <div className="absolute bottom-full left-0 z-30 mb-2 w-36 rounded-xl border border-border bg-popover p-1.5 shadow-2xl">
                    {["Low", "Medium", "High", "Max"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setThinkingLevel(option);
                          setShowThinkingDropdown(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-accent ${thinkingLevel === option ? "text-emerald-300" : "text-popover-foreground"}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="hidden items-center gap-1.5 truncate px-1 text-[11px] text-muted-foreground sm:flex">
                <Folder className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-32 truncate font-mono">{projectName}</span>
              </span>
              <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
                <GitBranch className="h-3.5 w-3.5" />
                <span className="font-mono">{branch}</span>
              </span>
            </div>

            <button
              type="submit"
              disabled={!prompt.trim() || isLoading || !repository}
              className="flex h-9 items-center gap-2 rounded-xl bg-violet-600 px-3.5 text-xs font-semibold text-white shadow-lg shadow-violet-950/30 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
              title="Send instruction"
            >
              {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>{isLoading ? "Working" : "Send"}</span>
            </button>
          </div>
        </form>

        {repository && !hasMessages && (
          <div className="mt-4 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            {STARTERS.map(({ label, description, icon: Icon, prompt: starterPrompt }) => (
              <button
                key={label}
                type="button"
                onClick={() => setPrompt(starterPrompt)}
                className="group flex items-start gap-3 rounded-xl border border-transparent bg-card/40 p-3 text-left transition-colors hover:border-border hover:bg-card"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-violet-400" />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-foreground">{label}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">{description}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <p className="mt-5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
          <ShieldCheck className="h-3 w-3" />
          Agent commands run against the selected local repository with provider safety controls.
        </p>
      </div>
    </main>
  );
}

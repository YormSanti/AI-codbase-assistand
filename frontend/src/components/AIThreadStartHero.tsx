import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Cpu,
  Copy,
  GitBranch,
  LoaderCircle,
  Mic,
  Search,
  Lightbulb,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { RepositoryInfo } from "@/types/domain";
import { useAppSettings } from "../hooks/useAppSettings";

interface AIThreadStartHeroProps {
  repository?: RepositoryInfo | null;
  onSubmitPrompt: (prompt: string, model: string) => void;
  onModelChange?: (model: string) => void;
  isLoading?: boolean;
  initialPrompt?: string | null;
  onInitialPromptConsumed?: () => void;
  messages?: { id: string; title: string; content: string; type: string }[];
  onResetThread?: () => void;
}

function formatAssistantTitle(rawTitle: string): string {
  if (!rawTitle) return "IFROG";
  const cleaned = rawTitle.replace(/\s*response$/i, "").trim();
  return cleaned || "IFROG";
}

function renderInlineMarkdown(text: string) {
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
  return tokens.map((token, i) => {
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
      return (
        <em key={i} className="italic text-muted-foreground">
          {token.slice(1, -1)}
        </em>
      );
    }
    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code
          key={i}
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-primary border border-border"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return token;
  });
}

function CodeBlock({ raw }: { raw: string }) {
  const [copied, setCopied] = useState(false);
  const lines = raw.slice(3, -3).trim().split("\n");
  const firstLine = lines[0]?.trim() || "";
  const isLang = /^[a-zA-Z0-9_#-]+$/.test(firstLine);
  const lang = isLang ? firstLine : "";
  const code = (isLang ? lines.slice(1) : lines).join("\n");

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2 text-[12px] font-mono text-muted-foreground">
        <span className="uppercase tracking-wider font-semibold">{lang || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] hover:bg-accent hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13.5px] leading-6 text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FormattedContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-4 text-[15px] leading-7 text-foreground antialiased font-normal">
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          return <CodeBlock key={index} raw={part} />;
        }

        const paragraphs = part.split(/\n\n+/);

        return (
          <div key={index} className="space-y-3.5">
            {paragraphs.map((para, pIdx) => {
              const trimmed = para.trim();
              if (!trimmed) return null;

              const lines = para.split("\n");
              const isBulletList = lines.every(
                (l) => !l.trim() || l.trim().startsWith("- ") || l.trim().startsWith("* ")
              );
              const isNumberedList = lines.every(
                (l) => !l.trim() || /^\d+\.\s/.test(l.trim())
              );

              if (isBulletList && lines.some((l) => l.trim().startsWith("- ") || l.trim().startsWith("* "))) {
                return (
                  <ul key={pIdx} className="space-y-2 my-3 pl-5 list-disc marker:text-muted-foreground">
                    {lines
                      .filter((l) => l.trim())
                      .map((line, lIdx) => (
                        <li key={lIdx} className="leading-7 pl-1">
                          {renderInlineMarkdown(line.trim().replace(/^[-*]\s+/, ""))}
                        </li>
                      ))}
                  </ul>
                );
              }

              if (isNumberedList && lines.some((l) => /^\d+\.\s/.test(l.trim()))) {
                return (
                  <ol key={pIdx} className="space-y-2 my-3 pl-5 list-decimal marker:text-muted-foreground">
                    {lines
                      .filter((l) => l.trim())
                      .map((line, lIdx) => (
                        <li key={lIdx} className="leading-7 pl-1">
                          {renderInlineMarkdown(line.trim().replace(/^\d+\.\s+/, ""))}
                        </li>
                      ))}
                  </ol>
                );
              }

              if (trimmed.startsWith("### ")) {
                return (
                  <h3 key={pIdx} className="text-[15px] font-semibold text-foreground mt-4 mb-1">
                    {renderInlineMarkdown(trimmed.slice(4))}
                  </h3>
                );
              }
              if (trimmed.startsWith("## ")) {
                return (
                  <h2 key={pIdx} className="text-base font-semibold text-foreground mt-5 mb-1.5">
                    {renderInlineMarkdown(trimmed.slice(3))}
                  </h2>
                );
              }
              if (trimmed.startsWith("# ")) {
                return (
                  <h1 key={pIdx} className="text-lg font-bold text-foreground mt-6 mb-2">
                    {renderInlineMarkdown(trimmed.slice(2))}
                  </h1>
                );
              }

              return (
                <p key={pIdx} className="leading-7">
                  {lines.map((line, lIdx) => (
                    <span key={lIdx}>
                      {renderInlineMarkdown(line)}
                      {lIdx < lines.length - 1 && <br />}
                    </span>
                  ))}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const QUICK_PROMPTS = [
  { label: "Explain this project", icon: Lightbulb, prompt: "Explain the architecture of this project and how its main parts fit together." },
  { label: "Review for bugs", icon: Search, prompt: "Review the code for likely bugs, security issues, and missing error handling. Cite files and lines." },
] as const;

const speechSupported = typeof window !== "undefined" && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

export function AIThreadStartHero({
  repository,
  onSubmitPrompt,
  onModelChange,
  isLoading = false,
  initialPrompt,
  onInitialPromptConsumed,
  messages = [],
  onResetThread,
}: AIThreadStartHeroProps) {
  const { settings } = useAppSettings();
  const conversationEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    conversationEnd.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [messages, isLoading]);

  const [prompt, setPrompt] = useState("");
  const [model, setModelState] = useState(settings.defaultProvider === "codex" ? "Codex" : "Gemini");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const setModel = (next: string | ((current: string) => string)) => {
    setModelState(current => {
      const value = typeof next === "function" ? next(current) : next;
      if (value !== current) onModelChange?.(value);
      return value;
    });
  };
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!initialPrompt) return;
    setPrompt(initialPrompt);
    onInitialPromptConsumed?.();
  }, [initialPrompt, onInitialPromptConsumed]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;
    onSubmitPrompt(trimmed, model);
    setPrompt("");
  };

  const handleQuickPrompt = (text: string) => {
    setPrompt(text);
    inputRef.current?.focus();
  };

  const handleToggleSpeech = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => setIsListening(true);
      rec.onresult = (e: any) => {
        const transcript = Array.from(e.results)
          .map((result: any) => result[0].transcript)
          .join("");
        setPrompt((prev) => (prev ? prev + " " : "") + transcript);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  return (
    <main
      className={`relative flex w-full flex-1 flex-col items-center overflow-x-hidden bg-background text-foreground px-4 py-6 sm:px-6 ${
        !hasMessages ? "justify-center" : "justify-between"
      }`}
      style={{ minHeight: "calc(100vh - 56px)", height: "100%" }}
    >
      {/* Top Header when conversation is active */}
      {hasMessages && (
        <div className="flex w-full max-w-[768px] items-center justify-between pb-3.5 pt-1 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-foreground">
              {repository?.name ? repository.name : "IFROG Chat"}
            </span>
            {repository?.current_branch && (
              <span className="flex items-center gap-1 rounded-md bg-muted border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                {repository.current_branch}
              </span>
            )}
          </div>
          {onResetThread && (
            <button
              type="button"
              onClick={onResetThread}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>New thread</span>
            </button>
          )}
        </div>
      )}

      {/* Conversation Log View when messages exist */}
      {hasMessages && (
        <div className="flex w-full max-w-[768px] flex-1 flex-col overflow-hidden my-2">
          <section
            aria-label="Conversation"
            role="log"
            aria-live="polite"
            className="flex-1 overflow-y-auto px-1 pt-6 pb-6 scroll-smooth"
          >
            {messages.map((message, index) => {
              const isUser = message.title === "You";
              const isWarning = message.type === "warning";

              if (isWarning) {
                return (
                  <article
                    key={message.id}
                    className={`flex w-full flex-col gap-2 ${index > 0 ? "mt-5" : "mt-0"}`}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{message.title}</span>
                    </div>
                    <div className="w-full rounded-2xl border border-rose-500/30 bg-rose-950/20 px-5 py-3.5 text-[14.5px] leading-relaxed text-rose-200">
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    </div>
                  </article>
                );
              }

              if (isUser) {
                return (
                  <article
                    key={message.id}
                    className={`flex w-full justify-end ${index > 0 ? "mt-8 sm:mt-10" : "mt-0"}`}
                  >
                    <div className="max-w-[78%] rounded-[22px] bg-muted px-5 py-2.5 text-[15px] leading-relaxed text-foreground shadow-sm sm:max-w-[70%]">
                      <p className="sr-only">You</p>
                      <div className="whitespace-pre-wrap break-words font-normal">
                        {message.content}
                      </div>
                    </div>
                  </article>
                );
              }

              return (
                <article
                  key={message.id}
                  className={`flex w-full flex-col ${index > 0 ? "mt-4 sm:mt-5" : "mt-0"}`}
                >
                  <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[13px] font-semibold tracking-wide text-muted-foreground">
                      {formatAssistantTitle(message.title)}
                    </span>
                  </div>
                  <div className="w-full text-[15px] leading-7 text-foreground pl-0.5">
                    <FormattedContent content={message.content} />
                  </div>
                </article>
              );
            })}
            {isLoading && (
              <div
                role="status"
                className="flex w-full items-center gap-3 py-3 pl-1 mt-4"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span>Waiting for a reply…</span>
                  <span className="flex gap-1">
                    <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                    <span className="h-1 w-1 rounded-full bg-primary animate-pulse [animation-delay:200ms]" />
                    <span className="h-1 w-1 rounded-full bg-primary animate-pulse [animation-delay:400ms]" />
                  </span>
                </div>
              </div>
            )}
            <div ref={conversationEnd} />
          </section>
        </div>
      )}

      {/* Composer Section (Centered in middle when !hasMessages, docked at bottom when hasMessages) */}
      <div
        className={`flex flex-col items-center transition-all ${
          !hasMessages
            ? "w-full max-w-[680px]"
            : "w-full max-w-[768px] mt-auto shrink-0 pt-2 pb-1"
        }`}
      >
        {/* Centered Heading: only when no messages */}
        {!hasMessages && (
          <h1 className="mb-7 select-none text-center text-3xl font-medium tracking-tight text-foreground sm:text-[32px]">
            What’s on the agenda today?
          </h1>
        )}

        {/* Input Pill / Capsule */}
        <form
          onSubmit={handleSubmit}
          className="relative flex h-[54px] w-full items-center rounded-full border border-border bg-card px-4 shadow-lg transition-colors focus-within:border-ring hover:bg-accent/40"
        >
          {/* Plus Button */}
          <div className="relative" ref={plusMenuRef}>
            <button
              type="button"
              onClick={() => setShowPlusMenu((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Options"
              aria-label="Options"
            >
              <Plus className="h-5 w-5" />
            </button>

            {showPlusMenu && (
              <div
                className={`absolute left-0 z-40 w-56 rounded-2xl border border-border bg-popover p-2 text-xs text-popover-foreground shadow-2xl ${
                  !hasMessages ? "top-full mt-2" : "bottom-full mb-2"
                }`}
              >
                {repository && (
                  <div className="border-b border-border px-3 py-2 text-muted-foreground">
                    <div className="font-medium text-foreground">{repository.name}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {repository.current_branch} • {repository.file_count ?? 0} files
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setModel((m) => (m === "Gemini" ? "Codex" : "Gemini"));
                    setShowPlusMenu(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-accent"
                >
                  <span>Provider</span>
                  <span className="font-mono text-muted-foreground">{model}</span>
                </button>
                {onResetThread && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetThread();
                      setShowPlusMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-accent"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Clear conversation</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask anything"
            disabled={isLoading}
            className="min-w-0 flex-1 bg-transparent px-3 text-[15px] font-normal text-foreground placeholder:text-muted-foreground outline-none"
            autoFocus
          />

          {/* Right Controls: Think, Mic, Waveform / Send Button */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Model picker */}
            <div className="relative" ref={modelMenuRef}>
              <button
                type="button"
                onClick={() => setShowModelMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={`Model: ${model}`}
                aria-haspopup="menu"
                aria-expanded={showModelMenu}
              >
                <Cpu className="h-[18px] w-[18px]" />
                <span>{model}</span>
              </button>

              {showModelMenu && (
                <div
                  role="menu"
                  className={`absolute right-0 z-40 w-48 rounded-2xl border border-border bg-popover p-2 text-xs text-popover-foreground shadow-2xl ${
                    !hasMessages ? "top-full mt-2" : "bottom-full mb-2"
                  }`}
                >
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Provider
                  </div>
                  {["Gemini", "Codex"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      role="menuitemradio"
                      aria-checked={model === opt}
                      onClick={() => {
                        setModel(opt);
                        setShowModelMenu(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left hover:bg-accent"
                    >
                      <span>{opt}</span>
                      {model === opt && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Microphone Button */}
            {speechSupported && <button
              type="button"
              onClick={handleToggleSpeech}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                isListening
                  ? "animate-pulse bg-rose-500/20 text-rose-400"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title={isListening ? "Listening… click to stop" : "Voice input"}
            >
              <Mic className="h-[18px] w-[18px]" />
            </button>}

            {/* Blue Circular Waveform / Send Button */}
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              title="Send instruction"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-center justify-center gap-[2.5px] h-3.5">
                  <span className="w-[2.5px] h-2 bg-current rounded-full" />
                  <span className="w-[2.5px] h-3.5 bg-current rounded-full" />
                  <span className="w-[2.5px] h-2.5 bg-current rounded-full" />
                  <span className="w-[2.5px] h-1.5 bg-current rounded-full" />
                </div>
              )}
            </button>
          </div>
        </form>

        {/* Quick prompts below the composer: only when no messages */}
        {!hasMessages ? (
          <div className="mt-5 flex w-full flex-col gap-2.5 pl-2 select-none">
            {QUICK_PROMPTS.map(({ label, icon: Icon, prompt: text }) => (
              <button
                key={label}
                type="button"
                onClick={() => handleQuickPrompt(text)}
                className="group flex w-fit items-center gap-3 py-1 text-left text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon className="h-[17px] w-[17px]" />
                <span className="text-[14.5px] font-normal">{label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-center text-[11px] text-muted-foreground select-none">
            Replies come from the selected CLI, which reads the project but never modifies files.
          </p>
        )}
      </div>
    </main>
  );
}

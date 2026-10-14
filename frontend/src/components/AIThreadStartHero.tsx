import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Brain,
  Check,
  Copy,
  GitBranch,
  Globe,
  LoaderCircle,
  Mic,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { RepositoryInfo } from "@/types/domain";
import { useAppSettings } from "../hooks/useAppSettings";

interface AIThreadStartHeroProps {
  repository?: RepositoryInfo | null;
  onSubmitPrompt: (prompt: string, model: string, thinkingLevel: string) => void;
  isLoading?: boolean;
  initialPrompt?: string | null;
  onInitialPromptConsumed?: () => void;
  messages?: { id: string; title: string; content: string; type: string }[];
  onResetThread?: () => void;
}

function formatAssistantTitle(rawTitle: string): string {
  if (!rawTitle) return "DevPilot";
  const cleaned = rawTitle.replace(/\s*response$/i, "").trim();
  return cleaned || "DevPilot";
}

function renderInlineMarkdown(text: string) {
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
  return tokens.map((token, i) => {
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return (
        <strong key={i} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
      return (
        <em key={i} className="italic text-zinc-300">
          {token.slice(1, -1)}
        </em>
      );
    }
    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code
          key={i}
          className="rounded-md bg-zinc-800/90 px-1.5 py-0.5 font-mono text-[13px] text-blue-300 border border-zinc-700/40"
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
    <div className="my-4 overflow-hidden rounded-xl border border-zinc-800 bg-[#121215] shadow-lg">
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-2 text-[12px] font-mono text-zinc-400">
        <span className="uppercase tracking-wider font-semibold text-zinc-300">{lang || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
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
      <pre className="overflow-x-auto p-4 font-mono text-[13.5px] leading-6 text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FormattedContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-4 text-[15px] leading-7 text-zinc-100 antialiased font-normal">
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
                  <ul key={pIdx} className="space-y-2 my-3 pl-5 list-disc marker:text-zinc-500">
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
                  <ol key={pIdx} className="space-y-2 my-3 pl-5 list-decimal marker:text-zinc-500">
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
                  <h3 key={pIdx} className="text-[15px] font-semibold text-white mt-4 mb-1">
                    {renderInlineMarkdown(trimmed.slice(4))}
                  </h3>
                );
              }
              if (trimmed.startsWith("## ")) {
                return (
                  <h2 key={pIdx} className="text-base font-semibold text-white mt-5 mb-1.5">
                    {renderInlineMarkdown(trimmed.slice(3))}
                  </h2>
                );
              }
              if (trimmed.startsWith("# ")) {
                return (
                  <h1 key={pIdx} className="text-lg font-bold text-white mt-6 mb-2">
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

export function AIThreadStartHero({
  repository,
  onSubmitPrompt,
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
  const thinkingMenuRef = useRef<HTMLDivElement>(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    conversationEnd.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [messages, isLoading]);

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(settings.defaultProvider === "codex" ? "Codex" : "Gemini");
  const [thinkingLevel, setThinkingLevel] = useState("High");
  const [showThinkingMenu, setShowThinkingMenu] = useState(false);
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
      if (thinkingMenuRef.current && !thinkingMenuRef.current.contains(e.target as Node)) {
        setShowThinkingMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;
    onSubmitPrompt(trimmed, model, thinkingLevel);
    setPrompt("");
  };

  const handleQuickAction = (action: "Write or edit" | "Search the web") => {
    if (action === "Write or edit") {
      setPrompt("Write or edit: ");
    } else {
      setPrompt("Search the web for: ");
    }
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
      className={`relative flex w-full flex-1 flex-col items-center overflow-x-hidden bg-black text-white px-4 py-6 sm:px-6 ${
        !hasMessages ? "justify-center" : "justify-between"
      }`}
      style={{ minHeight: "calc(100vh - 56px)", height: "100%" }}
    >
      {/* Top Header when conversation is active */}
      {hasMessages && (
        <div className="flex w-full max-w-[768px] items-center justify-between pb-3.5 pt-1 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-zinc-200">
              {repository?.name ? repository.name : "DevPilot Chat"}
            </span>
            {repository?.current_branch && (
              <span className="flex items-center gap-1 rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                <GitBranch className="h-3 w-3 text-zinc-500" />
                {repository.current_branch}
              </span>
            )}
          </div>
          {onResetThread && (
            <button
              type="button"
              onClick={onResetThread}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
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
                    <div className="max-w-[78%] rounded-[22px] bg-[#27272a] px-5 py-2.5 text-[15px] leading-relaxed text-zinc-100 shadow-sm sm:max-w-[70%]">
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
                  <div className="flex items-center gap-2 mb-2 text-zinc-300">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/15 text-blue-400">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[13px] font-semibold tracking-wide text-zinc-300">
                      {formatAssistantTitle(message.title)}
                    </span>
                  </div>
                  <div className="w-full text-[15px] leading-7 text-zinc-100 pl-0.5">
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
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                  <span>Waiting for a reply…</span>
                  <span className="flex gap-1">
                    <span className="h-1 w-1 rounded-full bg-blue-400 animate-pulse" />
                    <span className="h-1 w-1 rounded-full bg-blue-400 animate-pulse [animation-delay:200ms]" />
                    <span className="h-1 w-1 rounded-full bg-blue-400 animate-pulse [animation-delay:400ms]" />
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
          <h1 className="mb-7 select-none text-center text-3xl font-medium tracking-tight text-zinc-100 sm:text-[32px]">
            What’s on the agenda today?
          </h1>
        )}

        {/* Input Pill / Capsule */}
        <form
          onSubmit={handleSubmit}
          className="relative flex h-[54px] w-full items-center rounded-full border border-white/[0.08] bg-[#212121] px-4 shadow-2xl transition-all focus-within:border-white/20 focus-within:bg-[#252525] hover:bg-[#242424]"
        >
          {/* Plus Button */}
          <div className="relative" ref={plusMenuRef}>
            <button
              type="button"
              onClick={() => setShowPlusMenu((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              title="Options"
              aria-label="Options"
            >
              <Plus className="h-5 w-5" />
            </button>

            {showPlusMenu && (
              <div
                className={`absolute left-0 z-40 w-56 rounded-2xl border border-zinc-800 bg-[#1e1e1e] p-2 text-xs shadow-2xl ${
                  !hasMessages ? "top-full mt-2" : "bottom-full mb-2"
                }`}
              >
                {repository && (
                  <div className="border-b border-zinc-800/80 px-3 py-2 text-zinc-400">
                    <div className="font-medium text-zinc-200">{repository.name}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
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
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                  <span>Provider</span>
                  <span className="font-mono text-zinc-400">{model}</span>
                </button>
                {onResetThread && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetThread();
                      setShowPlusMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-zinc-300 hover:bg-zinc-800 hover:text-white"
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
            className="min-w-0 flex-1 bg-transparent px-3 text-[15px] font-normal text-zinc-100 placeholder:text-zinc-500 outline-none"
            autoFocus
          />

          {/* Right Controls: Think, Mic, Waveform / Send Button */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Think Button */}
            <div className="relative" ref={thinkingMenuRef}>
              <button
                type="button"
                onClick={() => setShowThinkingMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                title={`Thinking: ${thinkingLevel}, Model: ${model}`}
              >
                <Brain className="h-[18px] w-[18px] text-zinc-400" />
                <span>Think</span>
              </button>

              {showThinkingMenu && (
                <div
                  className={`absolute right-0 z-40 w-48 rounded-2xl border border-zinc-800 bg-[#1e1e1e] p-2 text-xs shadow-2xl ${
                    !hasMessages ? "top-full mt-2" : "bottom-full mb-2"
                  }`}
                >
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Model
                  </div>
                  {["Gemini", "Codex"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setModel(opt);
                        setShowThinkingMenu(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    >
                      <span>{opt}</span>
                      {model === opt && <Check className="h-3.5 w-3.5 text-blue-400" />}
                    </button>
                  ))}

                  <div className="mt-2 border-t border-zinc-800 px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Thinking Level
                  </div>
                  {["Low", "Medium", "High", "Max"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setThinkingLevel(opt);
                        setShowThinkingMenu(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    >
                      <span>{opt}</span>
                      {thinkingLevel === opt && <Check className="h-3.5 w-3.5 text-blue-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Microphone Button */}
            <button
              type="button"
              onClick={handleToggleSpeech}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                isListening
                  ? "animate-pulse bg-rose-500/20 text-rose-400"
                  : "text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
              title={isListening ? "Listening… click to stop" : "Voice input"}
            >
              <Mic className="h-[18px] w-[18px]" />
            </button>

            {/* Blue Circular Waveform / Send Button */}
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              title="Send instruction"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-md transition-all hover:bg-[#1d4ed8] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-white" />
              ) : (
                <div className="flex items-center justify-center gap-[2.5px] h-3.5">
                  <span className="w-[2.5px] h-2 bg-white rounded-full" />
                  <span className="w-[2.5px] h-3.5 bg-white rounded-full" />
                  <span className="w-[2.5px] h-2.5 bg-white rounded-full" />
                  <span className="w-[2.5px] h-1.5 bg-white rounded-full" />
                </div>
              )}
            </button>
          </div>
        </form>

        {/* Quick Action Links below Pill: only when no messages */}
        {!hasMessages ? (
          <div className="mt-5 flex w-full flex-col gap-2.5 pl-2 select-none">
            <button
              type="button"
              onClick={() => handleQuickAction("Write or edit")}
              className="group flex w-fit items-center gap-3 py-1 text-left text-zinc-400 transition-colors hover:text-zinc-100"
            >
              <Pencil className="h-[17px] w-[17px] text-zinc-400 transition-colors group-hover:text-zinc-200" />
              <span className="text-[14.5px] font-normal text-zinc-300 transition-colors group-hover:text-white">
                Write or edit
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickAction("Search the web")}
              className="group flex w-fit items-center gap-3 py-1 text-left text-zinc-400 transition-colors hover:text-zinc-100"
            >
              <Globe className="h-[17px] w-[17px] text-zinc-400 transition-colors group-hover:text-zinc-200" />
              <span className="text-[14.5px] font-normal text-zinc-300 transition-colors group-hover:text-white">
                Search the web
              </span>
            </button>
          </div>
        ) : (
          <p className="mt-2 text-center text-[11px] text-zinc-600 select-none">
            DevPilot can inspect files, run tests, and propose code changes.
          </p>
        )}
      </div>
    </main>
  );
}

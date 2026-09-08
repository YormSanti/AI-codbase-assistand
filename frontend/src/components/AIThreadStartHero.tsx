import React, { useState } from "react";
import type { RepositoryInfo } from "@/types/domain";
import { Folder, Laptop, GitBranch, Plus } from "lucide-react";

interface AIThreadStartHeroProps {
  repository?: RepositoryInfo | null;
  onSubmitPrompt: (prompt: string, model: string, thinkingLevel: string) => void;
  isLoading?: boolean;
  initialPrompt?: string | null;
  onInitialPromptConsumed?: () => void;
}

// Pixel-accurate gradient {G} logo from Screenshot 2
export function GradientGLogo({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="gradientG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00e5ff" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      {/* Left bracket { */}
      <path
        d="M10 11C10 8.5 8 7 6 7M6 7V17C6 18.5 4 20 2 20C4 20 6 21.5 6 23V33C8 33 10 31.5 10 29"
        stroke="url(#gradientG)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Letter G */}
      <path
        d="M26 14.5C24.2 12.2 20.8 11.5 17.5 13.5C14 15.8 13.5 21 16 24.5C18.2 27.8 23.5 27.5 26 24.5V20H20.5"
        stroke="url(#gradientG)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right bracket } */}
      <path
        d="M30 11C30 8.5 32 7 34 7M34 7V17C34 18.5 36 20 38 20C36 20 34 21.5 34 23V33C32 33 30 31.5 30 29"
        stroke="url(#gradientG)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AIThreadStartHero({
  repository,
  onSubmitPrompt,
  isLoading = false,
  initialPrompt,
  onInitialPromptConsumed,
}: AIThreadStartHeroProps) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("Antigravity");
  const [thinkingLevel, setThinkingLevel] = useState("High");
  const [executionTarget, setExecutionTarget] = useState("Local");
  const [branch, setBranch] = useState(repository?.current_branch || "santi");
  const [sandboxActive, setSandboxActive] = useState(true);

  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showThinkingDropdown, setShowThinkingDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  React.useEffect(() => {
    if (!initialPrompt) return;
    setPrompt(initialPrompt);
    onInitialPromptConsumed?.();
  }, [initialPrompt, onInitialPromptConsumed]);

  const projectName = repository?.name || "pharmacy-mobile-v2";

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;
    onSubmitPrompt(trimmed, model, thinkingLevel);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 select-none w-full min-h-[calc(100vh-80px)] bg-[#070b12]">
      <div className="w-full max-w-[680px] flex flex-col items-center gap-5">
        
        {/* ── Gradient {G} Logo ────────────────────────────────────────── */}
        <div className="flex items-center justify-center mb-1">
          <GradientGLogo className="w-10 h-10 drop-shadow-[0_0_20px_rgba(168,85,247,0.35)]" />
        </div>

        {/* ── Title: Start in pharmacy-mobile-v2 ───────────────────────── */}
        <div className="text-center mb-1">
          <h1 className="text-[22px] font-medium tracking-tight text-white flex items-center justify-center gap-2">
            <span className="font-semibold">Start in</span>
            <span className="text-zinc-300 font-normal">{projectName}</span>
          </h1>
        </div>

        {/* ── Top Pill Selectors (✦ Antigravity ⌵ / ⚙ High ⌵) ─────────── */}
        <div className="flex items-center gap-2 mb-2">
          {/* Model Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowModelDropdown(!showModelDropdown);
                setShowThinkingDropdown(false);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#111624] border border-[#1e293b] hover:border-zinc-700 text-zinc-200 text-xs font-medium transition-all shadow-sm"
            >
              <span className="text-[#a855f7] text-[13px] leading-none">✦</span>
              <span>{model}</span>
              <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" strokeWidth="2.5" fill="none" className="text-zinc-400">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showModelDropdown && (
              <div className="absolute left-0 top-full mt-1.5 w-48 rounded-xl bg-[#121827] border border-[#1e293b] p-1.5 shadow-2xl z-30 flex flex-col gap-0.5">
                {[
                  { name: "Antigravity", tag: "Agentic" },
                  { name: "Gemini 3.7 Flash", tag: "Thinking" },
                  { name: "Gemini 1.5 Pro", tag: "Deep Reasoning" },
                  { name: "OpenAI Codex", tag: "Code Synthesis" },
                  { name: "Claude 3.7 Sonnet", tag: "Hybrid" },
                ].map((m) => (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => {
                      setModel(m.name);
                      setShowModelDropdown(false);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                      model === m.name ? "bg-indigo-600/30 text-indigo-200 font-semibold" : "text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <span>{m.name}</span>
                    <span className="text-[10px] text-zinc-500">{m.tag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reasoning / Thinking Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowThinkingDropdown(!showThinkingDropdown);
                setShowModelDropdown(false);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#111624] border border-[#1e293b] hover:border-zinc-700 text-zinc-200 text-xs font-medium transition-all shadow-sm"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" className="text-zinc-400">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>{thinkingLevel}</span>
              <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" strokeWidth="2.5" fill="none" className="text-zinc-400">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showThinkingDropdown && (
              <div className="absolute left-0 top-full mt-1.5 w-36 rounded-xl bg-[#121827] border border-[#1e293b] p-1.5 shadow-2xl z-30 flex flex-col gap-0.5">
                {["Low", "Medium", "High", "Max"].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => {
                      setThinkingLevel(lvl);
                      setShowThinkingDropdown(false);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                      thinkingLevel === lvl ? "bg-indigo-600/30 text-indigo-200 font-semibold" : "text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Main Prompt Input Box (Screenshot-Identical) ─────────────── */}
        <div className="w-full rounded-2xl bg-[#0c101a] border border-[#1a2335] shadow-2xl overflow-hidden focus-within:border-indigo-500/50 transition-all">
          {/* Top text input row */}
          <div className="px-4 py-3.5 flex items-center gap-3">
            {/* Attachment + button */}
            <button
              type="button"
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
              title="Add file or context"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Input text */}
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask for a change, bug fix, or file..."
              className="flex-1 bg-transparent text-[13.5px] text-slate-100 placeholder-zinc-500 outline-none font-sans"
            />

            {/* Action buttons on the right */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Shield / Sandbox indicator */}
              <button
                type="button"
                onClick={() => setSandboxActive(!sandboxActive)}
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                  sandboxActive
                    ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
                    : "text-zinc-600 border-zinc-800 hover:text-zinc-400"
                }`}
                title={sandboxActive ? "Safe Sandbox Enabled" : "Direct Execution"}
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </button>

              {/* Magic wand optimizer */}
              <button
                type="button"
                onClick={() => {
                  if (prompt.trim()) {
                    setPrompt((prev) => `${prev} Provide precise code edits, file diffs, and verification steps.`);
                  }
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center border border-white/10 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                title="Enhance prompt"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 4-2 4 4-2z" />
                  <path d="m3 21 9-9" />
                  <path d="M12.2 6.8 17.2 11.8" />
                  <path d="M19 15v3" />
                  <path d="M20.5 16.5h-3" />
                </svg>
              </button>

              {/* Send button (Paper Plane / Navigation) */}
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={!prompt.trim() || isLoading}
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                  prompt.trim() && !isLoading
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 cursor-pointer"
                    : "bg-[#141b2a] border-white/10 text-zinc-500 cursor-not-allowed"
                }`}
                title="Send instruction"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="translate-x-[0.5px] -translate-y-[0.5px]">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Bottom status bar */}
          <div className="px-4 py-2 bg-[#090d16]/90 border-t border-[#172033] flex items-center justify-between text-xs text-zinc-400 flex-wrap gap-2">
            {/* Left: Project name */}
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Folder className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-mono text-[11.5px] text-zinc-300">{projectName}</span>
            </div>

            {/* Right: Environment & Git branch */}
            <div className="flex items-center gap-4">
              {/* Local environment dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowTargetDropdown(!showTargetDropdown);
                    setShowBranchDropdown(false);
                  }}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer text-[11.5px]"
                >
                  <Laptop className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{executionTarget}</span>
                  <svg viewBox="0 0 24 24" width="9" height="9" stroke="currentColor" strokeWidth="2.5" fill="none" className="text-zinc-500">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showTargetDropdown && (
                  <div className="absolute right-0 bottom-full mb-1.5 w-36 rounded-xl bg-[#121827] border border-[#1e293b] p-1.5 shadow-2xl z-30 flex flex-col gap-0.5">
                    {["Local", "Docker Sandbox", "Cloud VM"].map((target) => (
                      <button
                        key={target}
                        type="button"
                        onClick={() => {
                          setExecutionTarget(target);
                          setShowTargetDropdown(false);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                          executionTarget === target ? "bg-indigo-600/30 text-indigo-200 font-semibold" : "text-zinc-300 hover:bg-white/5"
                        }`}
                      >
                        {target}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Git branch dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowBranchDropdown(!showBranchDropdown);
                    setShowTargetDropdown(false);
                  }}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer text-[11.5px]"
                >
                  <GitBranch className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-mono text-[11.5px]">{branch}</span>
                  <svg viewBox="0 0 24 24" width="9" height="9" stroke="currentColor" strokeWidth="2.5" fill="none" className="text-zinc-500">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showBranchDropdown && (
                  <div className="absolute right-0 bottom-full mb-1.5 w-36 rounded-xl bg-[#121827] border border-[#1e293b] p-1.5 shadow-2xl z-30 flex flex-col gap-0.5">
                    {[repository?.current_branch || "santi", "main", "dev", "feature/auth"].filter(Boolean).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => {
                          setBranch(b);
                          setShowBranchDropdown(false);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs text-left font-mono transition-colors ${
                          branch === b ? "bg-indigo-600/30 text-indigo-200 font-semibold" : "text-zinc-300 hover:bg-white/5"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

import type { ProviderId } from "./providers";
import { apiStream } from "../api/client";

/** The desktop shell rejects prompts over 64,000 characters; stay safely below it. */
export const MAX_AGENT_PROMPT_CHARS = 60_000;
/** Diffs and other attached context are clipped to this many characters. */
export const MAX_CONTEXT_CHARS = 20_000;
/** Most recent conversation turns replayed to the CLI on a follow-up. */
export const MAX_REPLAYED_TURNS = 8;

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface RunAgentOptions {
  provider: ProviderId;
  prompt: string;
  /** Desktop app: run in this folder. */
  workingDirectory?: string | null;
  /** Browser build: run in this indexed project's folder. */
  repositoryId?: number | null;
  /** Receives streamed output as it arrives; the resolved value is always the complete reply. */
  onChunk?: (chunk: string) => void;
}

type AgentEvent = { type: "chunk"; text: string } | { type: "done"; content: string } | { type: "error"; message: string };

/**
 * Run one non-interactive request through the Codex or Gemini CLI: through the
 * Tauri command in the desktop app, through the local backend in the browser.
 */
export async function runAgent({ provider, prompt, workingDirectory, repositoryId, onChunk }: RunAgentOptions): Promise<string> {
  if (!isDesktopApp()) {
    let result: string | null = null;
    let failure: string | null = null;
    await apiStream<AgentEvent>("/api/agent/run", { provider, prompt, repository_id: repositoryId ?? null }, event => {
      if (event.type === "chunk") onChunk?.(event.text);
      else if (event.type === "done") result = event.content;
      else failure = event.message;
    });
    if (failure !== null) throw new Error(failure);
    if (result === null) throw new Error("The connection closed before the reply finished. Try again.");
    return result;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const streamId = crypto.randomUUID();
  let unlisten: (() => void) | undefined;
  if (onChunk) {
    const { listen } = await import("@tauri-apps/api/event");
    unlisten = await listen<{ streamId: string; chunk: string }>("agent-stream", event => {
      if (event.payload.streamId === streamId) onChunk(event.payload.chunk);
    });
  }
  try {
    const response = await invoke<{ content: string }>("run_agent", {
      request: { provider, prompt, workingDirectory: workingDirectory ?? null, streamId },
    });
    return response.content;
  } finally {
    unlisten?.();
  }
}

/** Fit long context into a prompt, cutting at a line break when possible. */
export function clipForPrompt(text: string, limit = MAX_CONTEXT_CHARS): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  const cut = text.lastIndexOf("\n", limit);
  return { text: text.slice(0, cut > limit * 0.8 ? cut : limit), truncated: true };
}

/** Longest run of `~` that starts a line (after up to three spaces), which could close a tilde fence. */
function longestTildeFence(text: string): number {
  let longest = 0;
  for (const match of text.matchAll(/^ {0,3}(~+)/gm)) longest = Math.max(longest, match[1].length);
  return longest;
}

/** Wrap text in a fenced block that cannot be closed early by fences inside it. */
export function fenced(text: string, language = ""): string {
  // A closing fence must be at least as long as the opening one, so go one longer than any inside.
  const fence = text.includes("```") ? "~".repeat(Math.max(4, longestTildeFence(text) + 1)) : "```";
  return `${fence}${language}\n${text.replace(/\s+$/, "")}\n${fence}`;
}

export type DiffScope = "staged" | "working tree" | "merge conflict" | `commit ${string}`;

/** Draft prompt asking the assistant to review one file's diff. */
export function diffReviewPrompt(path: string, scope: DiffScope, patch: string): string {
  const { text, truncated } = clipForPrompt(patch);
  return [
    `Review the ${scope} changes to \`${path}\`. Point out bugs, risky edits, and missing tests, and cite the relevant diff lines. Keep the review short and concrete.`,
    "",
    fenced(text, "diff"),
    ...(truncated ? ["", `(The diff was cut to its first ${MAX_CONTEXT_CHARS.toLocaleString("en-US")} characters.)`] : []),
  ].join("\n");
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * The CLIs are stateless, so follow-ups replay recent turns as text. Replay the
 * newest turns that fit the prompt budget, oldest first, and always keep the
 * latest message whole.
 */
export function buildConversationPrompt(
  history: ConversationTurn[],
  latest: string,
  assistantName: string,
  budget = MAX_AGENT_PROMPT_CHARS,
): string {
  const header = "Continue this conversation about the current repository.\n\n";
  const footer = `\n\nUser: ${latest}\n\nRespond to the latest user message.`;
  let remaining = budget - header.length - footer.length;
  const turns: string[] = [];
  for (let index = history.length - 1; index >= 0 && turns.length < MAX_REPLAYED_TURNS; index--) {
    const turn = `${history[index].role === "user" ? "User" : assistantName}: ${history[index].content}`;
    if (turn.length + 2 > remaining) break;
    turns.unshift(turn);
    remaining -= turn.length + 2;
  }
  return turns.length ? `${header}${turns.join("\n\n")}${footer}` : latest;
}

/** Draft prompt asking the assistant to review everything staged for the next commit. */
export function stagedReviewPrompt(stat: string, patch: string, truncatedByGit = false): string {
  const { text, truncated } = clipForPrompt(patch);
  return [
    "Review the staged changes below before I commit them. Point out bugs, risky edits, and missing tests, and cite the files and diff lines. Keep the review short and concrete.",
    "",
    "Files changed:",
    fenced(stat),
    "",
    fenced(text, "diff"),
    ...(truncated || truncatedByGit ? ["", "(The diff was cut; review what is shown and say if more context is needed.)"] : []),
  ].join("\n");
}

/** Prompt asking the assistant for a commit message for the staged changes. */
export function commitMessagePrompt(stat: string, patch: string, recentSubjects: string[] = [], truncatedByGit = false): string {
  const { text, truncated } = clipForPrompt(patch);
  const history = recentSubjects.filter(Boolean).slice(0, 8);
  return [
    "Write a git commit message for the staged changes below.",
    "",
    "Rules:",
    "- First line: an imperative summary of at most 72 characters.",
    "- Match the style of the recent commit subjects listed below (for example a Conventional Commits prefix such as feat: or fix:) when they follow one.",
    "- If it helps, add a blank line and a short body wrapped at 72 characters that explains what changed and why.",
    "- Reply with the commit message only: no code fences, quotes, labels, or commentary.",
    ...(history.length ? ["", "Recent commit subjects:", ...history.map(subject => `- ${subject}`)] : []),
    "",
    "Files changed:",
    fenced(stat),
    "",
    fenced(text, "diff"),
    ...(truncated || truncatedByGit ? ["", "(The diff was cut; base the message on the file list and what is shown.)"] : []),
  ].join("\n");
}

/** Turn a CLI reply into a clean commit message: no fences, labels, quotes, or trailing blank lines. */
export function cleanCommitMessage(reply: string): string {
  let text = reply.replace(/\r\n/g, "\n").trim();
  const fencedReply = text.match(/^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n\1\s*$/);
  if (fencedReply) text = fencedReply[2].trim();
  // A leading label such as "Commit message:" or "**Suggested commit message:**" (the colon is required,
  // so a real subject like "commit message parser: ..." is left alone).
  text = text.replace(/^\**\s*(?:suggested\s+)?commit message\s*(?::\s*\**|\**\s*:)\s*/i, "").trim();
  if (/^(["'`])[\s\S]*\1$/.test(text) && !text.includes("\n")) text = text.slice(1, -1).trim();
  return text.split("\n").map(line => line.replace(/\s+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

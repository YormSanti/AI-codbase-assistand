import type { ProviderId } from "./providers";

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
  workingDirectory?: string | null;
  /** Receives streamed output as it arrives; the resolved value is always the complete reply. */
  onChunk?: (chunk: string) => void;
}

/** Run one non-interactive request through the Codex or Gemini CLI (desktop app only). */
export async function runAgent({ provider, prompt, workingDirectory, onChunk }: RunAgentOptions): Promise<string> {
  if (!isDesktopApp()) throw new Error("AI providers run through the desktop app.");
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

/** Wrap text in a fenced block that cannot be closed early by fences inside it. */
export function fenced(text: string, language = ""): string {
  const fence = text.includes("```") ? "~~~~" : "```";
  return `${fence}${language}\n${text.replace(/\s+$/, "")}\n${fence}`;
}

export type DiffScope = "staged" | "working tree" | "merge conflict";

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

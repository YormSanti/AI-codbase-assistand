import { afterEach, describe, expect, it, vi } from "vitest";
import { runAgent, buildConversationPrompt, cleanCommitMessage, clipForPrompt, commitMessagePrompt, diffReviewPrompt, fenced, MAX_CONTEXT_CHARS, stagedReviewPrompt } from "./agent";

describe("agent prompt helpers", () => {
  it("clips long context at a line break and reports it", () => {
    const short = clipForPrompt("a\nb");
    expect(short).toEqual({ text: "a\nb", truncated: false });
    const long = "line of text\n".repeat(3000);
    const clipped = clipForPrompt(long, 1000);
    expect(clipped.truncated).toBe(true);
    expect(clipped.text.length).toBeLessThanOrEqual(1000);
    expect(clipped.text.endsWith("text")).toBe(true);
  });

  it("uses a fence the content cannot close", () => {
    expect(fenced("+const x = 1;\n", "diff")).toBe("```diff\n+const x = 1;\n```");
    expect(fenced("+```js\n+code\n+```", "diff")).toBe("~~~~diff\n+```js\n+code\n+```\n~~~~");
    // A context line that is itself a tilde fence must not close the block early.
    expect(fenced(" ```md\n ~~~~~\n+x", "diff")).toBe("~~~~~~diff\n ```md\n ~~~~~\n+x\n~~~~~~");
  });

  it("builds a review prompt naming the file, scope, and truncation", () => {
    const prompt = diffReviewPrompt("src/app.ts", "staged", "@@ -1 +1 @@\n-old\n+new\n");
    expect(prompt).toContain("Review the staged changes to `src/app.ts`");
    expect(prompt).toContain("```diff\n@@ -1 +1 @@\n-old\n+new\n```");
    expect(prompt).not.toContain("was cut");
    const huge = diffReviewPrompt("big.txt", "working tree", "+x\n".repeat(MAX_CONTEXT_CHARS));
    expect(huge).toContain("(The diff was cut to its first 20,000 characters.)");
    expect(huge.length).toBeLessThan(MAX_CONTEXT_CHARS + 400);
  });

  it("replays the newest turns that fit and always keeps the latest message", () => {
    expect(buildConversationPrompt([], "hello", "Codex")).toBe("hello");
    const history = [
      { role: "user" as const, content: "first question" },
      { role: "assistant" as const, content: "x".repeat(500) },
      { role: "user" as const, content: "second question" },
      { role: "assistant" as const, content: "second answer" },
    ];
    const full = buildConversationPrompt(history, "third question", "Codex");
    expect(full).toContain("User: first question");
    expect(full).toContain("Codex: second answer");
    expect(full.endsWith("User: third question\n\nRespond to the latest user message.")).toBe(true);

    const tight = buildConversationPrompt(history, "third question", "Codex", 300);
    expect(tight).not.toContain("first question");
    expect(tight).toContain("User: second question");
    expect(tight).toContain("Codex: second answer");
    expect(tight.length).toBeLessThanOrEqual(300);
  });
});

describe("commit message helpers", () => {
  it("asks for a message matching recent history with the stat and diff attached", () => {
    const prompt = commitMessagePrompt(" app.ts | 2 +-\n 1 file changed", "@@\n-a\n+b\n", ["feat: add search", "fix(git): stage renames"]);
    expect(prompt).toContain("at most 72 characters");
    expect(prompt).toContain("Recent commit subjects:\n- feat: add search\n- fix(git): stage renames");
    expect(prompt).toContain("Files changed:\n```\n app.ts | 2 +-\n 1 file changed\n```");
    expect(prompt).toContain("```diff\n@@\n-a\n+b\n```");
    expect(prompt).not.toContain("was cut");
    expect(commitMessagePrompt("stat", "+x", [], true)).toContain("(The diff was cut; base the message on the file list and what is shown.)");
  });

  it("cleans fences, labels, quotes, and stray whitespace from the reply", () => {
    expect(cleanCommitMessage("  feat: add search  \n")).toBe("feat: add search");
    expect(cleanCommitMessage("```\nfeat: add search\n\nExplain why.   \n```")).toBe("feat: add search\n\nExplain why.");
    expect(cleanCommitMessage("```text\nfix: x\n```")).toBe("fix: x");
    expect(cleanCommitMessage("Commit message: fix: handle empty input")).toBe("fix: handle empty input");
    expect(cleanCommitMessage("**Suggested commit message:** docs: update readme")).toBe("docs: update readme");
    expect(cleanCommitMessage('"chore: bump deps"')).toBe("chore: bump deps");
    expect(cleanCommitMessage("feat: a\n\n\n\nbody")).toBe("feat: a\n\nbody");
    expect(cleanCommitMessage("   ")).toBe("");
    expect(cleanCommitMessage("commit message parser: accept trailers")).toBe("commit message parser: accept trailers");
  });

  it("builds a staged review prompt", () => {
    const prompt = stagedReviewPrompt(" 2 files changed", "+x\n");
    expect(prompt).toContain("Review the staged changes below before I commit them.");
    expect(prompt).toContain("```diff\n+x\n```");
  });
});

function streamResponse(parts: string[]) {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    ok: true, status: 200,
    body: { getReader: () => ({ read: async () => index < parts.length ? { done: false, value: encoder.encode(parts[index++]) } : { done: true, value: undefined } }) },
  };
}

describe("runAgent in the browser build", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("streams chunks from the backend, even when events are split across reads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamResponse(['{"type":"chunk","text":"Hel', 'lo"}\n{"type":"chunk","text":" there"}\n', '{"type":"done","content":"Hello there"}\n']));
    vi.stubGlobal("fetch", fetchMock);
    const chunks: string[] = [];
    const reply = await runAgent({ provider: "codex", prompt: "hi", repositoryId: 7, onChunk: chunk => chunks.push(chunk) });
    expect(reply).toBe("Hello there");
    expect(chunks).toEqual(["Hello", " there"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/agent/run");
    expect(JSON.parse(init.body)).toEqual({ provider: "codex", prompt: "hi", repository_id: 7 });
  });

  it("turns error events, cut-off streams, and HTTP errors into exceptions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse(['{"type":"error","message":"Codex failed: quota"}\n'])));
    await expect(runAgent({ provider: "codex", prompt: "hi" })).rejects.toThrow("Codex failed: quota");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse(['{"type":"chunk","text":"partial"}\n'])));
    await expect(runAgent({ provider: "codex", prompt: "hi" })).rejects.toThrow("closed before the reply finished");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found", json: async () => ({ detail: "No repository with id=9" }) }));
    await expect(runAgent({ provider: "codex", prompt: "hi", repositoryId: 9 })).rejects.toThrow("No repository with id=9");
  });
});

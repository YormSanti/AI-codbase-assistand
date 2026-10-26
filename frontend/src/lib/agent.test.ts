import { describe, expect, it } from "vitest";
import { buildConversationPrompt, clipForPrompt, diffReviewPrompt, fenced, MAX_CONTEXT_CHARS } from "./agent";

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

import { afterEach, describe, expect, it } from "vitest";
import { conversationStorageKey, loadConversation, MAX_STORED_LOGS, removeConversation, removeProjectConversations, saveConversation, type StoredLog } from "./conversations";

const log = (id: number, content = "text"): StoredLog => ({ id: String(id), timestamp: "10:00:00", type: "thought", title: "You", content });

afterEach(() => localStorage.clear());

describe("conversation storage", () => {
  it("round-trips a conversation and drops malformed entries", () => {
    const key = conversationStorageKey(3, "default");
    expect(key).toBe("ifrog_ai_conversation:3:default");
    saveConversation(key, { logs: [log(1)], chatHistory: [{ role: "user", content: "hi", provider: "codex" }] });
    expect(loadConversation(key)).toEqual({ logs: [log(1)], chatHistory: [{ role: "user", content: "hi", provider: "codex" }] });

    localStorage.setItem(key, JSON.stringify({ logs: [log(2), { id: 5 }], chatHistory: [{ role: "bot", content: "x", provider: "codex" }] }));
    expect(loadConversation(key)).toEqual({ logs: [log(2)], chatHistory: [] });
    localStorage.setItem(key, "{not json");
    expect(loadConversation(key)).toEqual({ logs: [], chatHistory: [] });
    expect(loadConversation(null)).toEqual({ logs: [], chatHistory: [] });
  });

  it("keeps the newest entries within the count and size budget and removes empty conversations", () => {
    const key = conversationStorageKey(3, "t");
    saveConversation(key, { logs: Array.from({ length: MAX_STORED_LOGS + 30 }, (_, index) => log(index)), chatHistory: [] });
    const kept = loadConversation(key).logs;
    expect(kept).toHaveLength(MAX_STORED_LOGS);
    expect(kept.at(-1)?.id).toBe(String(MAX_STORED_LOGS + 29));

    saveConversation(key, { logs: Array.from({ length: 20 }, (_, index) => log(index, "x".repeat(50_000))), chatHistory: [] });
    expect(localStorage.getItem(key)!.length).toBeLessThanOrEqual(400_000);
    expect(loadConversation(key).logs.at(-1)?.id).toBe("19");

    saveConversation(key, { logs: [], chatHistory: [] });
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("removes one conversation or all of a project's", () => {
    saveConversation(conversationStorageKey(1, "a"), { logs: [log(1)], chatHistory: [] });
    saveConversation(conversationStorageKey(1, "b"), { logs: [log(2)], chatHistory: [] });
    saveConversation(conversationStorageKey(12, "a"), { logs: [log(3)], chatHistory: [] });
    removeConversation(conversationStorageKey(1, "a"));
    expect(localStorage.getItem(conversationStorageKey(1, "a"))).toBeNull();
    removeProjectConversations(1);
    expect(localStorage.getItem(conversationStorageKey(1, "b"))).toBeNull();
    expect(localStorage.getItem(conversationStorageKey(12, "a"))).not.toBeNull(); // prefix is exact, not "1*"
  });
});

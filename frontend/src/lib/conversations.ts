import { isProviderId, type ProviderId } from "./providers";
/**
 * AI conversations are kept per project and thread in localStorage so they
 * survive restarts, project switches, and threads being unmounted.
 */
export interface StoredLog {
  id: string;
  timestamp: string;
  type: "thought" | "result" | "warning";
  title: string;
  content: string;
}

export interface StoredTurn {
  role: "user" | "assistant";
  content: string;
  provider: ProviderId;
}

export interface StoredConversation {
  logs: StoredLog[];
  chatHistory: StoredTurn[];
}

const PREFIX = "ifrog_ai_conversation:";
export const MAX_STORED_LOGS = 120;
export const MAX_STORED_TURNS = 40;
export const MAX_STORED_CHARS = 400_000;

export function conversationStorageKey(projectId: number | string, threadId: string): string {
  return `${PREFIX}${projectId}:${threadId}`;
}

const isLog = (value: unknown): value is StoredLog => {
  const log = value as StoredLog;
  return Boolean(log) && typeof log.id === "string" && typeof log.timestamp === "string" && typeof log.title === "string"
    && typeof log.content === "string" && ["thought", "result", "warning"].includes(log.type);
};
const isTurn = (value: unknown): value is StoredTurn => {
  const turn = value as StoredTurn;
  return Boolean(turn) && typeof turn.content === "string" && ["user", "assistant"].includes(turn.role) && isProviderId(turn.provider);
};

export function loadConversation(key: string | null): StoredConversation {
  if (!key) return { logs: [], chatHistory: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as Partial<StoredConversation> | null;
    return {
      logs: Array.isArray(parsed?.logs) ? parsed.logs.filter(isLog) : [],
      chatHistory: Array.isArray(parsed?.chatHistory) ? parsed.chatHistory.filter(isTurn) : [],
    };
  } catch {
    return { logs: [], chatHistory: [] };
  }
}

/** Save the newest part of a conversation that fits the storage budget; an empty conversation removes the entry. */
export function saveConversation(key: string, conversation: StoredConversation): void {
  try {
    if (!conversation.logs.length && !conversation.chatHistory.length) {
      localStorage.removeItem(key);
      return;
    }
    let logs = conversation.logs.slice(-MAX_STORED_LOGS);
    const chatHistory = conversation.chatHistory.slice(-MAX_STORED_TURNS);
    let serialized = JSON.stringify({ logs, chatHistory });
    while (serialized.length > MAX_STORED_CHARS && logs.length > 1) {
      logs = logs.slice(Math.ceil(logs.length / 4));
      serialized = JSON.stringify({ logs, chatHistory });
    }
    localStorage.setItem(key, serialized);
  } catch {
    // Storage full or unavailable: the conversation stays in memory for this session.
  }
}

export function removeConversation(key: string): void {
  try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
}

/** Remove every stored conversation of a project, for example when it is removed from IFROG. */
export function removeProjectConversations(projectId: number | string): void {
  try {
    const prefix = `${PREFIX}${projectId}:`;
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));
  } catch { /* storage unavailable */ }
}

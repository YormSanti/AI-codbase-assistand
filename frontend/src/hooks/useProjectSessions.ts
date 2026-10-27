import { useEffect, useState } from "react";

export interface ProjectThread {
  id: string;
  projectId: string | number;
  title: string;
  createdAt: string;
}

export function useProjectSessions(projectId?: number) {
  const key = projectId == null ? null : `threads_${projectId}`;
  const [threads, setThreads] = useState<ProjectThread[]>([]);
  useEffect(() => {
    const read = () => {
      try {
        const saved: unknown = JSON.parse(key ? localStorage.getItem(key) ?? "[]" : "[]");
        setThreads(Array.isArray(saved) ? saved.filter((item): item is ProjectThread =>
          item && typeof item.id === "string" && typeof item.title === "string" &&
          typeof item.createdAt === "string" && item.projectId === projectId) : []);
      } catch { setThreads([]); }
    };
    read();
    window.addEventListener("project-sessions-changed", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("project-sessions-changed", read);
      window.removeEventListener("storage", read);
    };
  }, [key, projectId]);

  const save = (updated: ProjectThread[]) => {
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(updated));
    setThreads(updated);
    window.dispatchEvent(new Event("project-sessions-changed"));
  };
  return { threads, save };
}

/** Prefix of the title new threads get before their first message. */
export const DEFAULT_THREAD_TITLE_PREFIX = "Session · ";

export function titleFromPrompt(prompt: string): string {
  const firstLine = prompt.trim().split("\n", 1)[0].replace(/\s+/g, " ");
  return firstLine.length > 48 ? `${firstLine.slice(0, 47).trimEnd()}…` : firstLine;
}

/** Name a still-untitled thread after its first message, and tell open sidebars to re-read. */
export function renameThreadIfDefault(projectId: number, threadId: string, prompt: string): void {
  const key = `threads_${projectId}`;
  try {
    const threads: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(threads)) return;
    const index = threads.findIndex(item => item && item.id === threadId);
    const title = titleFromPrompt(prompt);
    if (index === -1 || !title || typeof threads[index].title !== "string" || !threads[index].title.startsWith(DEFAULT_THREAD_TITLE_PREFIX)) return;
    threads[index] = { ...threads[index], title };
    localStorage.setItem(key, JSON.stringify(threads));
    window.dispatchEvent(new Event("project-sessions-changed"));
  } catch { /* storage unavailable or malformed: keep the default title */ }
}

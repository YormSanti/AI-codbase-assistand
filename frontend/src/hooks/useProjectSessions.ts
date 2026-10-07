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

import React, { useState, useEffect } from "react";
import type { RepositoryInfo } from "@/types/domain";
import { repositoryApi } from "@/api/repositoryApi";
import { Trash2 } from "lucide-react";

export interface ProjectThread {
  id: string;
  projectId: string | number;
  title: string;
  createdAt: string;
}

interface ProjectsSidebarNavProps {
  currentRepository?: RepositoryInfo | null;
  onOpenRepository?: (path: string) => Promise<void> | void;
  onSelectTab?: (tab: string) => void;
  onSelectThread?: (threadId: string) => void;
  onDeleteRepository?: (repositoryId: number) => Promise<void> | void;
}

// Fine multi-ray starburst icon matching the screenshot
export function StarburstIcon({ className = "w-4 h-4 text-zinc-400" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className}
    >
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
      <line x1="8.5" y1="3" x2="9.8" y2="6.5" />
      <line x1="14.2" y1="17.5" x2="15.5" y2="21" />
      <line x1="3" y1="8.5" x2="6.5" y2="9.8" />
      <line x1="17.5" y1="14.2" x2="21" y2="15.5" />
      <line x1="15.5" y1="3" x2="14.2" y2="6.5" />
      <line x1="9.8" y1="17.5" x2="8.5" y2="21" />
      <line x1="3" y1="15.5" x2="6.5" y2="14.2" />
      <line x1="17.5" y1="9.8" x2="21" y2="8.5" />
    </svg>
  );
}

// Folder with inner prompt squiggle icon
export function CodeFolderIcon({ className = "w-4 h-4 text-zinc-300" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M7.5 13.5c1.2-1.2 2 1.2 3.2 0" strokeWidth="1.4" />
    </svg>
  );
}

// Plain folder outline icon
export function FolderOutlineIcon({ className = "w-4 h-4 text-zinc-400" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

// Sparkle outline icon for header
export function SparkleIcon({ className = "w-4 h-4 text-zinc-400" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
      <circle cx="19" cy="5" r="1" fill="currentColor" />
    </svg>
  );
}

// List icon for header
export function ListLinesIcon({ className = "w-4 h-4 text-zinc-400" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Terminal mini icon >_
export function TerminalBadgeIcon({ className = "w-3.5 h-3.5 text-zinc-300" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="4" />
      <path d="m8 9 3 3-3 3" />
      <path d="M13 15h3" />
    </svg>
  );
}

// Sparkle with plus mini icon
export function SparklePlusIcon({ className = "w-3.5 h-3.5 text-zinc-300" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m11 3-1.6 4.9a2 2 0 0 1-1.2 1.2L3 11l5.2 1.9a2 2 0 0 1 1.2 1.2L11 19l1.6-4.9a2 2 0 0 1 1.2-1.2L19 11l-5.2-1.9a2 2 0 0 1-1.2-1.2z" />
      <path d="M19 2v4" />
      <path d="M21 4h-4" />
    </svg>
  );
}

export function ProjectsSidebarNav({
  currentRepository,
  onOpenRepository,
  onSelectTab,
  onSelectThread,
  onDeleteRepository,
}: ProjectsSidebarNavProps) {
  const [projectsList, setProjectsList] = useState<RepositoryInfo[]>([]);
  const [threads, setThreads] = useState<ProjectThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProjectPath, setNewProjectPath] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load projects
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const list = await repositoryApi.list();
        if (isMounted) {
          if (list.length === 0 && !currentRepository) {
            // Provide default showcase project items if database is empty
            setProjectsList([
              {
                id: 1,
                name: "pharmacy-mobile-v2",
                root_path: "/home/ksk/pharmacy-mobile-v2",
                current_branch: "main",
                head_commit: "9c3f1a2e4b",
                opened_at: new Date().toISOString(),
                file_count: 84,
              },
              {
                id: 2,
                name: "pharmkulen-web",
                root_path: "/home/ksk/pharmkulen-web",
                current_branch: "main",
                head_commit: "4e7b8c1a9d",
                opened_at: new Date().toISOString(),
                file_count: 52,
              },
            ]);
          } else {
            setProjectsList(list);
          }
        }
      } catch {
        if (isMounted) {
          // Fallback showcase items
          setProjectsList([
            {
              id: 1,
              name: currentRepository ? currentRepository.name : "pharmacy-mobile-v2",
              root_path: currentRepository ? currentRepository.root_path : "/home/ksk/pharmacy-mobile-v2",
              current_branch: currentRepository?.current_branch || "main",
              head_commit: currentRepository?.head_commit || "9c3f1a2e4b",
              opened_at: currentRepository?.opened_at || new Date().toISOString(),
              file_count: currentRepository?.file_count || 84,
            },
            {
              id: 2,
              name: "pharmkulen-web",
              root_path: "/home/ksk/pharmkulen-web",
              current_branch: "main",
              head_commit: "4e7b8c1a9d",
              opened_at: new Date().toISOString(),
              file_count: 52,
            },
          ]);
        }
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [currentRepository]);

  // Load threads for active project from localStorage
  useEffect(() => {
    const projKey = currentRepository ? `threads_${currentRepository.id}` : "threads_default";
    const saved = localStorage.getItem(projKey);
    if (saved) {
      try {
        setThreads(JSON.parse(saved));
      } catch {
        setThreads([]);
      }
    } else {
      setThreads([]);
    }
  }, [currentRepository]);

  const handleCreateNewThread = () => {
    const projId = currentRepository?.id || "default";
    const newThread: ProjectThread = {
      id: crypto.randomUUID(),
      projectId: projId,
      title: `Thread ${threads.length + 1}`,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    const updated = [newThread, ...threads];
    setThreads(updated);
    setActiveThreadId(newThread.id);
    localStorage.setItem(currentRepository ? `threads_${currentRepository.id}` : "threads_default", JSON.stringify(updated));

    if (onSelectThread) {
      onSelectThread(newThread.id);
    }
    if (onSelectTab) {
      onSelectTab("ai");
    }
  };

  const handleDeleteThread = (event: React.MouseEvent, thread: ProjectThread) => {
    event.stopPropagation();
    if (!window.confirm(`Delete “${thread.title}”?`)) return;

    const updated = threads.filter((item) => item.id !== thread.id);
    setThreads(updated);
    if (activeThreadId === thread.id) setActiveThreadId(null);
    const storageKey = currentRepository ? `threads_${currentRepository.id}` : "threads_default";
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleDeleteProject = async (event: React.MouseEvent, project: RepositoryInfo) => {
    event.stopPropagation();
    if (!window.confirm(`Remove “${project.name}” from IFROG? Your project files will not be deleted.`)) return;

    setDeleteError(null);
    try {
      if (onDeleteRepository) {
        await onDeleteRepository(project.id);
      } else {
        await repositoryApi.remove(project.id);
      }
      localStorage.removeItem(`threads_${project.id}`);
      setProjectsList((current) => current.filter((item) => item.id !== project.id));
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not remove this project.");
    }
  };

  const handleOpenNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newProjectPath.trim();
    if (!trimmed) return;
    setIsAdding(true);
    setAddError(null);
    try {
      if (onOpenRepository) {
        await onOpenRepository(trimmed);
      }
      setShowAddModal(false);
      setNewProjectPath("");
      const list = await repositoryApi.list();
      setProjectsList(list);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to open repository");
    } finally {
      setIsAdding(false);
    }
  };

  const handleBrowseFolder = async () => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        setNewProjectPath(selected);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Determine active project display name
  const activeProj = currentRepository || (projectsList.length > 0 ? projectsList[0] : {
    id: 1,
    name: "pharmacy-mobile-v2",
    root_path: "/home/ksk/pharmacy-mobile-v2",
  });

  const otherProjects = projectsList.filter(
    (p) => p.name !== activeProj.name && p.root_path !== activeProj.root_path
  );

  return (
    <div className="w-full select-none text-zinc-300 font-sans">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 text-zinc-400">
        <span className="text-[13px] font-medium tracking-tight text-[#94a3b8]">
          Projects
        </span>

        <div className="flex items-center gap-1.5">
          {/* Sparkles / AI Action */}
          <button
            type="button"
            onClick={() => onSelectTab?.("ai")}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="AI Assistant"
          >
            <SparkleIcon className="w-4 h-4" />
          </button>

          {/* List View Toggle */}
          <button
            type="button"
            onClick={() => onSelectTab?.("projects")}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Projects Catalog"
          >
            <ListLinesIcon className="w-4 h-4" />
          </button>

          {/* Plus Add Project Button */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center w-[22px] h-[22px] rounded-md bg-[#161c28] border border-white/10 text-zinc-300 hover:bg-white/15 hover:text-white transition-all shadow-sm ml-0.5"
            title="Add Project"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.4" fill="none">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Projects List Container ───────────────────────────────────────── */}
      <div className="flex flex-col gap-1 px-1.5 py-1">
        {deleteError && (
          <div role="alert" className="mx-1 mb-1 rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">
            {deleteError}
          </div>
        )}
        {/* ── Active Project Card ─────────────────────────────────────────── */}
        <div
          className="group relative flex items-center justify-between rounded-xl px-2.5 py-2 bg-[#121927] border border-[#1e293b]/90 shadow-sm cursor-pointer hover:border-blue-500/30 transition-all"
          onClick={() => onSelectTab?.("explorer")}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="flex-shrink-0 text-zinc-300">
              <CodeFolderIcon className="w-4 h-4 text-zinc-200" />
            </div>
            <span
              className="truncate text-[13.5px] font-medium text-slate-100 leading-none tracking-tight"
              title={activeProj.name}
            >
              {activeProj.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Terminal quick-launch */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTab?.("terminal");
              }}
              className="flex items-center justify-center w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/15 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Open Terminal"
            >
              <TerminalBadgeIcon className="w-3.5 h-3.5" />
            </button>

            {/* AI Agent quick-launch */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTab?.("ai");
              }}
              className="flex items-center justify-center w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/15 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="AI Agent Studio"
            >
              <SparklePlusIcon className="w-3.5 h-3.5" />
            </button>

            {currentRepository && (
              <button
                type="button"
                onClick={(event) => void handleDeleteProject(event, currentRepository)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-rose-500/15 hover:text-rose-300 focus-visible:text-rose-300"
                title="Remove Project"
                aria-label={`Remove ${currentRepository.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Indented Sub-Thread Item ─────────────────────────────────────── */}
        <div className="relative flex items-center pl-3 py-1 my-0.5">
          {/* Vertical left accent line */}
          <div className="absolute left-[13px] top-0 bottom-0 w-[2px] bg-indigo-500/70 rounded-full" />

          {/* "New thread" clickable row */}
          <div
            className="flex items-center gap-2.5 pl-6 py-1.5 rounded-lg w-full text-zinc-400 hover:text-slate-100 hover:bg-white/[0.04] cursor-pointer transition-colors"
            onClick={handleCreateNewThread}
          >
            <StarburstIcon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 flex-shrink-0" />
            <span className="text-[13px] font-normal tracking-tight">
              New thread
            </span>
          </div>
        </div>

        {/* List of active threads if any */}
        {threads.map((thread) => (
          <div key={thread.id} className="relative flex items-center pl-3 py-0.5">
            <div className="absolute left-[13px] top-0 bottom-0 w-[2px] bg-indigo-500/30 rounded-full" />
            <div
              className={`flex items-center justify-between pl-6 pr-2 py-1.5 rounded-lg w-full cursor-pointer transition-colors ${
                activeThreadId === thread.id
                  ? "bg-indigo-950/40 text-indigo-200 font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              }`}
              onClick={() => {
                setActiveThreadId(thread.id);
                onSelectThread?.(thread.id);
                onSelectTab?.("ai");
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <StarburstIcon className="w-3 h-3 text-indigo-400/80 flex-shrink-0" />
                <span className="truncate text-[12.5px]">{thread.title}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 font-mono">{thread.createdAt}</span>
                <button
                  type="button"
                  onClick={(event) => handleDeleteThread(event, thread)}
                  className="flex h-5 w-5 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-rose-500/15 hover:text-rose-300 focus-visible:text-rose-300"
                  title="Delete Thread"
                  aria-label={`Delete ${thread.title}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* ── Other Projects (e.g. pharmkulen-web) ─────────────────────────── */}
        {otherProjects.length > 0 ? (
          otherProjects.map((p) => (
            <div
              key={p.id || p.root_path}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-white/[0.05] cursor-pointer transition-colors group"
              onClick={() => {
                if (onOpenRepository) {
                  void onOpenRepository(p.root_path);
                }
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex-shrink-0 text-zinc-400 group-hover:text-zinc-300">
                  <FolderOutlineIcon className="w-4 h-4" />
                </div>
                <span
                  className="truncate text-[13.5px] font-normal text-zinc-300 group-hover:text-white tracking-tight"
                  title={p.name}
                >
                  {p.name}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                  title="Indexed & Ready"
                />
                <button
                  type="button"
                  onClick={(event) => void handleDeleteProject(event, p)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-rose-500/15 hover:text-rose-300 focus-visible:text-rose-300"
                  title="Remove Project"
                  aria-label={`Remove ${p.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div
            className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-white/[0.05] cursor-pointer transition-colors group"
            onClick={() => setShowAddModal(true)}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex-shrink-0 text-zinc-400 group-hover:text-zinc-300">
                <FolderOutlineIcon className="w-4 h-4" />
              </div>
              <span className="truncate text-[13.5px] font-normal text-zinc-300 group-hover:text-white tracking-tight">
                pharmkulen-web
              </span>
            </div>
            <div className="flex-shrink-0 flex items-center pr-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Open Project Modal ─────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#121824] border border-white/10 p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CodeFolderIcon className="w-5 h-5 text-indigo-400" />
                <span>Open Project Repository</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Enter the local filesystem path to a Git repository to index AST symbols and begin AI pair-programming.
            </p>

            <form onSubmit={handleOpenNewProject} className="flex flex-col gap-3">
              <input
                type="text"
                value={newProjectPath}
                onChange={(e) => setNewProjectPath(e.target.value)}
                placeholder="/home/user/my-project"
                disabled={isAdding}
                className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-indigo-500"
              />

              {addError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                  {addError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                {"__TAURI_INTERNALS__" in window && (
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    disabled={isAdding}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10"
                  >
                    Browse Folder
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding || !newProjectPath.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isAdding ? "Opening..." : "Open Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

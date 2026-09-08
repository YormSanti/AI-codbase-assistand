import React, { useState, useEffect } from "react";
import {
  FolderGit2,
  FolderOpen,
  GitBranch,
  GitCommit,
  FileCode2,
  Search,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Clock,
  HardDrive,
  Copy,
  Check,
  FolderPlus,
  Terminal,
  Bot,
  BarChart3,
  Files,
} from "lucide-react";
import type { RepositoryInfo } from "../types/domain";
import { repositoryApi } from "../api/repositoryApi";
import { ApiError } from "../api/client";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  StarburstIcon,
  CodeFolderIcon,
  FolderOutlineIcon,
  SparkleIcon,
  ListLinesIcon,
  TerminalBadgeIcon,
  SparklePlusIcon,
  type ProjectThread,
} from "./ProjectsSidebarNav";

interface Props {
  currentRepository: RepositoryInfo | null;
  isLoading: boolean;
  onOpen: (path: string) => Promise<void> | void;
  onNavigate: (tab: string) => void;
}

export function ProjectsPage({
  currentRepository,
  isLoading,
  onOpen,
  onNavigate,
}: Props) {
  const [projects, setProjects] = useState<RepositoryInfo[]>([]);
  const [isFetchingProjects, setIsFetchingProjects] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualPath, setManualPath] = useState("");
  const [openError, setOpenError] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [threads, setThreads] = useState<ProjectThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchProjects = async () => {
    setIsFetchingProjects(true);
    setOpenError(null);
    try {
      const list = await repositoryApi.list();
      setProjects(list);
    } catch (err) {
      console.error("Failed to load repositories list", err);
    } finally {
      setIsFetchingProjects(false);
    }
  };

  useEffect(() => {
    void fetchProjects();
  }, [currentRepository?.id]);

  // Load threads from local storage
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

  const handleOpenPath = async (path: string) => {
    const trimmed = path.trim();
    if (!trimmed) return;
    setOpenError(null);
    try {
      await onOpen(trimmed);
      setManualPath("");
      setShowAddModal(false);
      void fetchProjects();
    } catch (err) {
      setOpenError(err instanceof ApiError ? err.message : "Failed to open repository");
    }
  };

  const handleBrowseFolder = async () => {
    if (!("__TAURI_INTERNALS__" in window)) {
      return;
    }
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        setManualPath(selected);
        await handleOpenPath(selected);
      }
    } catch (err) {
      console.error("Failed to browse folder", err);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(text);
    setTimeout(() => setCopiedPath(null), 2000);
  };

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
    localStorage.setItem(
      currentRepository ? `threads_${currentRepository.id}` : "threads_default",
      JSON.stringify(updated)
    );
    onNavigate("ai");
  };

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.root_path.toLowerCase().includes(q) ||
      (p.current_branch && p.current_branch.toLowerCase().includes(q))
    );
  });

  const totalFilesIndexed = projects.reduce((acc, p) => acc + (p.file_count || 0), 0);

  const cardStyle: React.CSSProperties = {
    borderRadius: "20px",
    background: "rgba(18, 18, 24, 0.9)",
    border: "1.5px solid rgba(255, 255, 255, 0.08)",
    padding: "28px",
    boxShadow: "0 8px 32px -8px rgba(0, 0, 0, 0.4)",
    display: "flex",
    flexDirection: "column",
  };

  return (
    <div
      style={{
        padding: "28px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        width: "100%",
        boxSizing: "border-box",
        color: "#f8fafc",
      }}
    >
      {/* ── Top Header Card ──────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "32px 36px",
          borderRadius: "24px",
          background:
            "linear-gradient(135deg, rgba(88,28,255,0.16) 0%, rgba(37,99,235,0.12) 50%, rgba(16,185,129,0.06) 100%)",
          border: "1.5px solid rgba(139,92,246,0.30)",
          boxShadow: "0 16px 48px -12px rgba(88,28,255,0.2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "24px",
        }}
      >
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "10px" }}>
            <div
              style={{
                padding: "12px",
                borderRadius: "16px",
                background: "linear-gradient(135deg, #7c3aed, #2563eb)",
                boxShadow: "0 8px 20px -4px rgba(124,58,237,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FolderGit2 size={26} color="white" />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  color: "rgba(167,139,250,0.9)",
                }}
              >
                DevPilot Workspace Hub
              </p>
              <h1
                style={{
                  margin: 0,
                  fontSize: "26px",
                  fontWeight: "800",
                  color: "white",
                  letterSpacing: "-0.5px",
                }}
              >
                Projects & Repositories
              </h1>
            </div>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "13.5px",
              color: "rgba(255, 255, 255, 0.65)",
              maxWidth: "560px",
              lineHeight: 1.5,
            }}
          >
            Manage and index your local codebases, launch interactive AI threads, inspect AST symbols, or open terminal workspaces.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", zIndex: 2 }}>
          <Button
            variant="outline"
            onClick={() => void fetchProjects()}
            disabled={isFetchingProjects}
            className="flex items-center gap-2 rounded-xl bg-white/5 border-white/10 hover:bg-white/10 text-white font-semibold px-4 py-2.5"
          >
            <RefreshCw size={15} className={isFetchingProjects ? "animate-spin" : ""} />
            <span>Refresh</span>
          </Button>

          {"__TAURI_INTERNALS__" in window && (
            <Button
              onClick={handleBrowseFolder}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-5 py-2.5 shadow-lg shadow-violet-600/30"
            >
              <FolderPlus size={16} />
              <span>Browse Folder</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats Summary Row ───────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        {[
          {
            label: "Total Projects",
            value: projects.length > 0 ? String(projects.length) : "0",
            sub: "indexed in local SQLite db",
            icon: FolderGit2,
            color: "#60a5fa",
            borderColor: "rgba(96,165,250,0.3)",
          },
          {
            label: "Current Active",
            value: currentRepository ? currentRepository.name : "None",
            sub: currentRepository ? `Branch: ${currentRepository.current_branch || "main"}` : "No repository active",
            icon: CheckCircle2,
            color: currentRepository ? "#34d399" : "#94a3b8",
            borderColor: currentRepository ? "rgba(52,211,153,0.3)" : "rgba(148,163,184,0.2)",
          },
          {
            label: "Total Indexed Files",
            value: totalFilesIndexed.toLocaleString(),
            sub: "across all local projects",
            icon: Files,
            color: "#a78bfa",
            borderColor: "rgba(167,139,250,0.3)",
          },
          {
            label: "Storage & Cache",
            value: "Local SQLite",
            sub: "zero-cloud, offline-first",
            icon: HardDrive,
            color: "#fb923c",
            borderColor: "rgba(251,146,60,0.3)",
          },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              style={{
                padding: "20px 22px",
                borderRadius: "18px",
                background: "rgba(18,18,24,0.9)",
                border: `1.5px solid ${stat.borderColor}`,
                boxShadow: `0 0 15px -5px ${stat.borderColor}`,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "rgba(255,255,255,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                  }}
                >
                  {stat.label}
                </span>
                <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(255,255,255,0.06)" }}>
                  <Icon size={16} color={stat.color} />
                </div>
              </div>
              <div>
                <p
                  style={{
                    margin: "0 0 2px 0",
                    fontSize: "20px",
                    fontWeight: "800",
                    color: "white",
                    fontFamily: "var(--font-code)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {stat.value}
                </p>
                <p style={{ margin: 0, fontSize: "11.5px", color: "rgba(255,255,255,0.5)" }}>{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Main Dual Section: Projects Sidebar Panel + Spotlight Details ──── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 340px) 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* ── Left: Exact Screenshot Replicating Widget ─────────────────── */}
        <div
          style={{
            borderRadius: "20px",
            background: "#0d111a",
            border: "1.5px solid rgba(255,255,255,0.1)",
            padding: "16px 14px",
            boxShadow: "0 12px 36px -8px rgba(0,0,0,0.6)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* Header Row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px 8px 8px" }}>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#8b949e", letterSpacing: "0.2px" }}>
              Projects
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                onClick={() => onNavigate("ai")}
                style={{
                  padding: "4px",
                  borderRadius: "6px",
                  background: "transparent",
                  border: "none",
                  color: "#8b949e",
                  cursor: "pointer",
                }}
                title="AI Agent"
              >
                <SparkleIcon className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => void fetchProjects()}
                style={{
                  padding: "4px",
                  borderRadius: "6px",
                  background: "transparent",
                  border: "none",
                  color: "#8b949e",
                  cursor: "pointer",
                }}
                title="Project List"
              >
                <ListLinesIcon className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  background: "#1c2333",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#e2e8f0",
                  cursor: "pointer",
                }}
                title="Open New Project"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.4" fill="none">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Active Project Card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: "12px",
              padding: "10px 12px",
              background: "#131b2e",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              cursor: "pointer",
            }}
            onClick={() => onNavigate("explorer")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, paddingRight: "8px" }}>
              <CodeFolderIcon className="w-4 h-4 text-slate-200 flex-shrink-0" />
              <span
                style={{
                  fontSize: "13.5px",
                  fontWeight: "500",
                  color: "#f8fafc",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={currentRepository ? currentRepository.name : "pharmacy-mobile-v2"}
              >
                {currentRepository ? currentRepository.name : "pharmacy-mobile-v2"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate("terminal");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "26px",
                  height: "26px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  color: "#cbd5e1",
                  cursor: "pointer",
                }}
                title="Launch Terminal"
              >
                <TerminalBadgeIcon className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate("ai");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "26px",
                  height: "26px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  color: "#cbd5e1",
                  cursor: "pointer",
                }}
                title="Launch AI Agent"
              >
                <SparklePlusIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Indented Sub-Thread Item */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", paddingLeft: "14px", margin: "4px 0" }}>
            {/* Vertical guide line */}
            <div
              style={{
                position: "absolute",
                left: "14px",
                top: 0,
                bottom: 0,
                width: "2px",
                background: "#4f46e5",
                borderRadius: "99px",
              }}
            />

            {/* "New thread" button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                paddingLeft: "26px",
                paddingTop: "8px",
                paddingBottom: "8px",
                borderRadius: "8px",
                width: "100%",
                color: "#94a3b8",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              className="hover:bg-white/[0.04] hover:text-white"
              onClick={handleCreateNewThread}
            >
              <StarburstIcon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <span style={{ fontSize: "13px", fontWeight: "400" }}>New thread</span>
            </div>
          </div>

          {/* Additional threads */}
          {threads.map((t) => (
            <div key={t.id} style={{ position: "relative", display: "flex", alignItems: "center", paddingLeft: "14px" }}>
              <div
                style={{
                  position: "absolute",
                  left: "14px",
                  top: 0,
                  bottom: 0,
                  width: "2px",
                  background: "rgba(99, 102, 241, 0.4)",
                  borderRadius: "99px",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingLeft: "26px",
                  paddingRight: "8px",
                  paddingTop: "6px",
                  paddingBottom: "6px",
                  borderRadius: "8px",
                  width: "100%",
                  cursor: "pointer",
                  color: activeThreadId === t.id ? "#c7d2fe" : "#94a3b8",
                  background: activeThreadId === t.id ? "rgba(99, 102, 241, 0.15)" : "transparent",
                }}
                onClick={() => {
                  setActiveThreadId(t.id);
                  onNavigate("ai");
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <StarburstIcon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                  <span style={{ fontSize: "12.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.title}
                  </span>
                </div>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-code)" }}>
                  {t.createdAt}
                </span>
              </div>
            </div>
          ))}

          {/* Screenshot-identical second project item */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: "10px",
              padding: "8px 12px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            className="hover:bg-white/[0.05]"
            onClick={() => setShowAddModal(true)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <FolderOutlineIcon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <span
                style={{
                  fontSize: "13.5px",
                  color: "#cbd5e1",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                pharmkulen-web
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", paddingRight: "4px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 6px rgba(16,185,129,0.7)",
                }}
                title="Online & Ready"
              />
            </div>
          </div>
        </div>

        {/* ── Right: Project Spotlight & Open Repository Form ──────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Active Project Highlight Card */}
          {currentRepository && (
            <div
              style={{
                ...cardStyle,
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(18, 18, 24, 0.95) 100%)",
                border: "1.5px solid rgba(52, 211, 153, 0.35)",
                boxShadow: "0 8px 32px -8px rgba(16, 185, 129, 0.2)",
                gap: "20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#10b981",
                      boxShadow: "0 0 10px #10b981",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "800",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      color: "#34d399",
                    }}
                  >
                    Currently Active Project
                  </span>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate("explorer")}
                    className="rounded-lg bg-white/5 border-white/10 hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Files size={13} className="text-blue-400" />
                    <span>Explorer</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate("terminal")}
                    className="rounded-lg bg-white/5 border-white/10 hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Terminal size={13} className="text-amber-400" />
                    <span>Terminal</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate("git")}
                    className="rounded-lg bg-white/5 border-white/10 hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <GitBranch size={13} className="text-emerald-400" />
                    <span>Git</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate("ai")}
                    className="rounded-lg bg-white/5 border-white/10 hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Bot size={13} className="text-violet-400" />
                    <span>AI Agent</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate("analytics")}
                    className="rounded-lg bg-white/5 border-white/10 hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <BarChart3 size={13} className="text-orange-400" />
                    <span>Analytics</span>
                  </Button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <h2 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "800", color: "white" }}>
                    {currentRepository.name}
                  </h2>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>
                    <span style={{ fontFamily: "var(--font-code)" }}>{currentRepository.root_path}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentRepository.root_path)}
                      title="Copy Path"
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "rgba(255,255,255,0.5)",
                        padding: "2px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {copiedPath === currentRepository.root_path ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 14px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <GitBranch size={15} color="#34d399" />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "white" }}>
                      {currentRepository.current_branch || "main"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 14px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <GitCommit size={15} color="#60a5fa" />
                    <span style={{ fontSize: "13px", fontFamily: "var(--font-code)", color: "white" }}>
                      {currentRepository.head_commit?.slice(0, 7) || "—"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 14px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <FileCode2 size={15} color="#a78bfa" />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#c4b5fd" }}>
                      {currentRepository.file_count || 0} files
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Open / Index Form */}
          <div style={{ ...cardStyle }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", gap: "10px" }}>
              <FolderOpen size={18} color="#60a5fa" />
              <span>Open or Index a Project Repository</span>
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
              Provide the absolute path to any local Git repository. DevPilot will index its directory structure, compute hashes respecting <code className="text-violet-300 font-mono text-xs">.gitignore</code>, and parse source code with Tree-sitter.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleOpenPath(manualPath);
              }}
              style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}
            >
              <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
                <FolderGit2
                  size={18}
                  style={{
                    position: "absolute",
                    left: "16px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "rgba(255,255,255,0.4)",
                  }}
                />
                <Input
                  type="text"
                  placeholder="/home/user/my-awesome-project"
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  disabled={isLoading}
                  style={{
                    paddingLeft: "46px",
                    height: "46px",
                    borderRadius: "14px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1.5px solid rgba(255,255,255,0.12)",
                    color: "white",
                    fontSize: "13.5px",
                    fontFamily: "var(--font-code)",
                  }}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !manualPath.trim()}
                className="h-[46px] px-6 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-violet-600/30"
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Indexing Repository...</span>
                  </>
                ) : (
                  <>
                    <span>Open Project</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>

              {"__TAURI_INTERNALS__" in window && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBrowseFolder}
                  disabled={isLoading}
                  className="h-[46px] px-5 rounded-xl bg-white/5 border-white/10 hover:bg-white/10 text-white font-semibold flex items-center gap-2"
                >
                  <FolderPlus size={16} className="text-violet-400" />
                  <span>Browse</span>
                </Button>
              )}
            </form>

            {openError && (
              <div
                style={{
                  marginTop: "14px",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "rgba(244, 63, 94, 0.12)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  color: "#fb7185",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                {openError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Indexed Projects List / Repository Catalog ─────────────────── */}
      <div style={{ ...cardStyle }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: "700" }}>Indexed Repositories</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
              All projects previously indexed and persisted in your local SQLite store
            </p>
          </div>

          <div style={{ position: "relative", width: "280px" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "rgba(255,255,255,0.4)",
              }}
            />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: "38px",
                height: "40px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                fontSize: "13px",
              }}
            />
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <FolderGit2 size={40} style={{ opacity: 0.3 }} />
            <div>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "white", margin: "0 0 4px 0" }}>
                {searchQuery ? "No projects matching your search" : "No indexed repositories yet"}
              </p>
              <p style={{ fontSize: "12.5px", margin: 0 }}>
                {searchQuery
                  ? "Try searching for a different project name or directory."
                  : "Open a local Git repository above to start indexing."}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {filteredProjects.map((project) => {
              const isActive = currentRepository?.id === project.id || currentRepository?.root_path === project.root_path;

              return (
                <div
                  key={project.id}
                  style={{
                    padding: "18px 20px",
                    borderRadius: "16px",
                    background: isActive ? "rgba(52, 211, 153, 0.06)" : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${isActive ? "rgba(52, 211, 153, 0.4)" : "rgba(255,255,255,0.07)"}`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                        <div
                          style={{
                            padding: "7px",
                            borderRadius: "10px",
                            background: isActive ? "rgba(52,211,153,0.15)" : "rgba(139,92,246,0.12)",
                          }}
                        >
                          <FolderGit2 size={16} color={isActive ? "#34d399" : "#a78bfa"} />
                        </div>
                        <h4
                          style={{
                            margin: 0,
                            fontSize: "15px",
                            fontWeight: "700",
                            color: "white",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {project.name}
                        </h4>
                      </div>

                      {isActive && (
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: "700",
                            padding: "2px 8px",
                            borderRadius: "99px",
                            background: "rgba(16,185,129,0.15)",
                            color: "#34d399",
                            border: "1px solid rgba(52,211,153,0.3)",
                          }}
                        >
                          Active
                        </span>
                      )}
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.5)",
                        fontFamily: "var(--font-code)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={project.root_path}
                    >
                      {project.root_path}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "rgba(255,255,255,0.6)", flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <GitBranch size={13} color="#34d399" />
                        {project.current_branch || "main"}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <FileCode2 size={13} color="#60a5fa" />
                        {project.file_count} files
                      </span>
                      {project.opened_at && (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                          <Clock size={12} />
                          {new Date(project.opened_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <button
                      type="button"
                      onClick={() => handleCopy(project.root_path)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "transparent",
                        border: "none",
                        color: "rgba(255,255,255,0.45)",
                        fontSize: "12px",
                        cursor: "pointer",
                        padding: "4px 6px",
                        borderRadius: "6px",
                      }}
                    >
                      {copiedPath === project.root_path ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                      <span>{copiedPath === project.root_path ? "Copied" : "Copy Path"}</span>
                    </button>

                    {isActive ? (
                      <Button
                        size="sm"
                        onClick={() => onNavigate("explorer")}
                        className="rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold"
                      >
                        View Files
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => void handleOpenPath(project.root_path)}
                        disabled={isLoading}
                        className="rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5"
                      >
                        <span>Switch</span>
                        <ArrowRight size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Project Dialog ─────────────────────────────────────────── */}
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

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleOpenPath(manualPath);
              }}
              className="flex flex-col gap-3"
            >
              <input
                type="text"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                placeholder="/home/user/my-project"
                disabled={isLoading}
                className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-indigo-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                {"__TAURI_INTERNALS__" in window && (
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    disabled={isLoading}
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
                  disabled={isLoading || !manualPath.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? "Opening..." : "Open Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

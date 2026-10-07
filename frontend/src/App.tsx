import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import { repositoryApi } from "./api/repositoryApi";
import { editorApi } from "./api/editorApi";
import { ApiError } from "./api/client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { AIAgentPage } from "@/components/AIAgentPage";
import { DashboardPage } from "@/components/DashboardPage";
import { ExplorerPage } from "@/components/ExplorerPage";
import { GitPage } from "@/components/GitPage";
import { TerminalPage } from "@/components/TerminalPage";
import { AnalyticsPage } from "@/components/AnalyticsPage";
import { SettingsPage } from "@/components/SettingsPage";

import type { FilePreview, RepositoryInfo, TreeNode } from "./types/domain";
import { AlertCircle } from "lucide-react";
import { useAutoUpdater } from "./hooks/useAutoUpdater";
import { useAppearance } from "./hooks/useAppearance";

export default function App() {
  const { settings } = useAppearance();
  useAutoUpdater();
  const [repository, setRepository] = useState<RepositoryInfo | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [terminalRepositories, setTerminalRepositories] = useState<(RepositoryInfo | null)[]>([]);
  const [hasVisitedAi, setHasVisitedAi] = useState(false);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState("default");
  const [visitedThreads, setVisitedThreads] = useState<string[]>(["default"]);

  const [isSessionRestored, setIsSessionRestored] = useState(false);
  const repositoryRequest = useRef(0);
  const editorState = useRef({ dirty: false, saving: false });
  const handleEditorStateChange = useCallback((state: { dirty: boolean; saving: boolean }) => {
    editorState.current = state;
  }, []);

  function canLeaveEditor() {
    if (editorState.current.saving) {
      setError("Please wait for the file to finish saving.");
      return false;
    }
    return !editorState.current.dirty || window.confirm("Discard your unsaved changes and continue?");
  }

  function handleSelectTab(tab: string) {
    if (tab === activeTab) return;
    const staysInWorkspace = ["explorer", "editor"].includes(activeTab) && ["explorer", "editor"].includes(tab);
    const editorOnlyFile = selectedFile?.file_id !== null && selectedFile?.file_id !== undefined && selectedFile.file_id < 0;
    if ((!staysInWorkspace || editorOnlyFile) && !canLeaveEditor()) return;
    if (editorOnlyFile && tab !== "editor") setSelectedFile(null);
    setActiveTab(tab);
  }

  function handleFileSaved(preview: FilePreview) {
    const updateNode = (node: TreeNode): TreeNode => node.file_id === preview.file_id
      ? { ...node, size_bytes: preview.size_bytes ?? node.size_bytes }
      : { ...node, children: node.children.map(updateNode) };
    setTree(current => current ? updateNode(current) : current);
    setSelectedFile(current => current ? updateNode(current) : current);
  }

  function handleSelectThread(threadId: string) {
    if (!canLeaveEditor()) return;
    setAiDraft(null);
    setActiveThread(threadId);
    setVisitedThreads(current => current.includes(threadId) ? current : [...current, threadId]);
    setActiveTab("ai");
  }

  useEffect(() => {
    if (activeTab !== "terminal" || !isSessionRestored || isLoading) return;
    // Keep each project's terminal page mounted with its original working directory.
    setTerminalRepositories(current => current.some(item => item?.root_path === repository?.root_path)
      ? current
      : [...current, repository]);
  }, [activeTab, isSessionRestored, isLoading, repository]);

  useEffect(() => {
    if ((activeTab === "ai" || activeTab === "ai-agent") && !hasVisitedAi) {
      setHasVisitedAi(true);
    }
  }, [activeTab, hasVisitedAi]);

  // Restore session
  useEffect(() => {
    let isMounted = true;
    const requestId = ++repositoryRequest.current;
    
    const restoreSession = async () => {
      let label = "main";
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          label = getCurrentWindow().label;
        } catch (e) {
          console.warn("Failed to get window label", e);
        }
      }
      
      if (label === "main" && isMounted && requestId === repositoryRequest.current) {
        const savedTab = localStorage.getItem("ifrog_active_tab");
        const savedRepo = localStorage.getItem("ifrog_repo_path");
        
        if (savedTab) {
          setActiveTab(savedTab === "projects" ? "explorer" : savedTab);
        }
        if (savedRepo) {
          setIsLoading(true);
          try {
            const info = await repositoryApi.open(savedRepo);
            if (!isMounted || requestId !== repositoryRequest.current) return;
            const treeData = await repositoryApi.getTree(info.id);
            const savedFilePath = localStorage.getItem("ifrog_selected_file");
            let foundNode: TreeNode | null = null;
            if (savedFilePath && treeData) {
              const findNode = (node: TreeNode): TreeNode | null => {
                if (node.path === savedFilePath) return node;
                if (node.children) {
                  for (const child of node.children) {
                    const found = findNode(child);
                    if (found) return found;
                  }
                }
                return null;
              };
              foundNode = findNode(treeData);
              if (!foundNode && savedTab === "editor") {
                foundNode = findNode(await editorApi.getTree(info.id));
              }
            }
            if (isMounted && requestId === repositoryRequest.current) {
              setRepository(info);
              setTree(treeData);
              if (foundNode) setSelectedFile(foundNode);
            }
          } catch (err) {
            if (isMounted && requestId === repositoryRequest.current) {
              setError(err instanceof ApiError ? err.message : "Failed to restore repository");
            }
          } finally {
            if (isMounted) {
              if (requestId === repositoryRequest.current) setIsLoading(false);
              setIsSessionRestored(true);
            }
          }
        } else if (isMounted) {
          setIsSessionRestored(true);
        }
      } else if (isMounted) {
        setIsSessionRestored(true);
      }
    };
    
    restoreSession();
    return () => { isMounted = false; };
  }, []);

  // Save session
  useEffect(() => {
    if (!isSessionRestored) return;

    const saveSession = async () => {
      let label = "main";
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          label = getCurrentWindow().label;
        } catch {
          // ignore
        }
      }
      
      if (label === "main") {
        localStorage.setItem("ifrog_active_tab", activeTab);
        if (selectedFile) {
          localStorage.setItem("ifrog_selected_file", selectedFile.path);
        } else {
          localStorage.removeItem("ifrog_selected_file");
        }
        if (repository?.root_path) {
          localStorage.setItem("ifrog_repo_path", repository.root_path);
        } else {
          localStorage.removeItem("ifrog_repo_path");
        }
      }
    };
    
    saveSession();
  }, [activeTab, isSessionRestored, repository?.root_path, selectedFile?.path, selectedFile]);

  async function handleOpen(path: string, nextTab?: string) {
    if (!canLeaveEditor()) throw new Error("Project switch canceled. Save or discard your edits first.");
    const requestId = ++repositoryRequest.current;
    setIsLoading(true);
    setError(null);
    try {
      const info = await repositoryApi.open(path);
      if (requestId !== repositoryRequest.current) return;
      const treeData = await repositoryApi.getTree(info.id);
      if (requestId !== repositoryRequest.current) return;
      // Commit a complete workspace only after both requests succeed.
      setRepository(info);
      setTree(treeData);
      setSelectedFile(null);
      setIsSessionRestored(true);
      if (nextTab) setActiveTab(nextTab);
    } catch (err) {
      if (requestId !== repositoryRequest.current) return;
      setError(err instanceof ApiError ? err.message : "Failed to open repository");
      throw err;
    } finally {
      if (requestId === repositoryRequest.current) setIsLoading(false);
    }
  }

  function handleSelectFile(node: TreeNode) {
    if (!node.is_directory && (node.file_id !== selectedFile?.file_id || node.path !== selectedFile?.path) && canLeaveEditor()) {
      setSelectedFile(node);
    }
  }

  function handleAskAIAboutFile(node: TreeNode) {
    if (!canLeaveEditor()) return;
    setAiDraft(`Review @${node.path}. Explain its responsibility, identify likely issues, and suggest focused improvements.`);
    setActiveTab("ai");
  }

  async function handleDeleteRepository(repositoryId: number) {
    if (repository?.id === repositoryId && !canLeaveEditor()) {
      throw new Error("Project removal canceled. Save or discard your edits first.");
    }
    await repositoryApi.remove(repositoryId);
    setTerminalRepositories(current => current.filter(item => item?.id !== repositoryId));
    if (repository?.id === repositoryId) {
      setRepository(null);
      setTree(null);
      setSelectedFile(null);
      localStorage.removeItem("ifrog_repo_path");
      localStorage.removeItem("ifrog_selected_file");
      setActiveTab("explorer");
    }
  }

  return (
    <SidebarProvider className={settings.sidebarPosition === "right" ? "flex-row-reverse" : undefined}>
      <AppSidebar
        side={settings.sidebarPosition}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        repository={repository}
        onOpenRepository={handleOpen}
        onOpenTerminal={(path) => handleOpen(path, "terminal")}
        onDeleteRepository={handleDeleteRepository}
        onSelectThread={handleSelectThread}
      />

      <SidebarInset className="min-w-0">
        <SiteHeader hasRepository={Boolean(repository)} currentView={activeTab} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", height: "100%", minHeight: 0, overflowY: activeTab === "ai" || activeTab === "ai-agent" ? "hidden" : "auto", backgroundColor: "var(--background)" }}>
          {error && (
            <div className="error-banner" role="alert" style={{ margin: "16px 20px 0" }}>
              <AlertCircle className="error-icon" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Dashboard */}
          {activeTab === "dashboard" && (
            <DashboardPage
              repository={repository}
              tree={tree}
              isLoading={isLoading}
              onNavigate={handleSelectTab}
            />
          )}

          {/* Shared file workspace retains drafts between Explorer and Code Editor. */}
          {(activeTab === "explorer" || activeTab === "editor") && (
            <ExplorerPage
              mode={activeTab === "editor" ? "editor" : "explorer"}
              repository={repository}
              tree={tree}
              selectedFile={selectedFile}
              isLoading={isLoading}
              onOpen={handleOpen}
              onSelectFile={handleSelectFile}
              onCloseFile={() => setSelectedFile(null)}
              onAskAI={handleAskAIAboutFile}
              onEditorStateChange={handleEditorStateChange}
              onFileSaved={handleFileSaved}
            />
          )}

          {/* Terminal */}
          {terminalRepositories.map(terminalRepository => {
            const isActive = activeTab === "terminal" && terminalRepository?.root_path === repository?.root_path;
            return (
              <div key={terminalRepository?.root_path ?? "home"} style={{ display: isActive ? "flex" : "none", flex: 1, minHeight: 0, flexDirection: "column" }}>
                <TerminalPage repository={terminalRepository} isActive={isActive} />
              </div>
            );
          })}

          {/* Git Repository */}
          {activeTab === "git" && (
            <GitPage
              key={repository?.id ?? "none"}
              repository={repository}
              onNavigate={handleSelectTab}
            />
          )}

          {/* AI Agent */}
          {hasVisitedAi && (
            <div style={{ display: (activeTab === "ai" || activeTab === "ai-agent") ? "flex" : "none", flex: 1, width: "100%", height: "100%", minHeight: 0, flexDirection: "column", backgroundColor: "#000000" }}>
              {visitedThreads.map(threadId => (
              <div key={`${repository?.id ?? "none"}:${threadId}`} style={{ display: threadId === activeThread ? "flex" : "none", flex: 1, width: "100%", height: "100%", minHeight: 0, flexDirection: "column", backgroundColor: "#000000" }}>
              <AIAgentPage
                repository={repository}
                initialPrompt={threadId === activeThread ? aiDraft : null}
                onInitialPromptConsumed={() => setAiDraft(null)}
              />
              </div>
              ))}
            </div>
          )}

          {/* Analytics & Code Charts */}
          {(activeTab === "analytics" || activeTab === "chart" || activeTab === "charts") && (
            <AnalyticsPage
              repository={repository}
              tree={tree}
              isLoading={isLoading}
              onNavigate={handleSelectTab}
              onOpen={handleOpen}
            />
          )}

          {/* Settings */}
          {activeTab === "settings" && (
            <SettingsPage />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { useState } from "react";
import "./App.css";
import { repositoryApi } from "./api/repositoryApi";
import { ApiError } from "./api/client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { RepositoryPicker } from "@/components/RepositoryPicker";
import { RepositorySummary } from "@/components/RepositorySummary";
import { RepositoryTree } from "@/components/RepositoryTree";
import { FileInspector } from "@/components/FileInspector";
import { AIAgentPage } from "@/components/AIAgentPage";
import { DashboardPage } from "@/components/DashboardPage";

import type { RepositoryInfo, TreeNode } from "./types/domain";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, FolderSearch, FolderTree, Zap, Search, Sliders, Play } from "lucide-react";


export default function App() {
  const [repository, setRepository] = useState<RepositoryInfo | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  async function handleOpen(path: string) {
    setIsLoading(true);
    setError(null);
    setSelectedFile(null);
    try {
      const info = await repositoryApi.open(path);
      const treeData = await repositoryApi.getTree(info.id);
      setRepository(info);
      setTree(treeData);
    } catch (err) {
      setRepository(null);
      setTree(null);
      setError(err instanceof ApiError ? err.message : "Failed to open repository");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelectFile(node: TreeNode) {
    if (!node.is_directory) {
      setSelectedFile(node);
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        repository={repository}
      />

      <SidebarInset>
        <SiteHeader hasRepository={Boolean(repository)} currentView={activeTab} />

        <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8 bg-background w-full h-full min-h-0">
          {error && (
            <div className="error-banner mb-2" role="alert">
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
              onOpen={handleOpen}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {/* File Explorer tab — keep legacy layout */}
          {activeTab === "explorer" && (
            <div className="flex flex-col gap-8">
              <Card className="p-6 bg-card border-border shadow-sm">
                <h3 className="text-base font-semibold mb-4 text-foreground">Open Code Repository</h3>
                <RepositoryPicker onOpen={handleOpen} isLoading={isLoading} />
              </Card>
              {repository && <RepositorySummary repository={repository} />}
              {tree ? (
                <div className="grid gap-8 md:grid-cols-2 min-h-[520px]">
                  <Card className="p-6 flex flex-col bg-card border-border shadow-sm">
                    <h3 className="text-base font-semibold mb-4 text-foreground">File Explorer</h3>
                    <RepositoryTree root={tree} onSelectFile={handleSelectFile} selectedFilePath={selectedFile?.path} />
                  </Card>
                  <Card className="p-6 flex flex-col bg-card border-border shadow-sm">
                    {selectedFile ? (
                      <FileInspector file={selectedFile} onClose={() => setSelectedFile(null)} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center p-10 text-muted-foreground gap-3">
                        <FolderSearch className="h-12 w-12 opacity-50 text-blue-400" />
                        <h4 className="text-lg font-semibold text-foreground">Select a file to inspect</h4>
                        <p className="text-xs max-w-xs leading-relaxed">Click any file in the Explorer tree on the left to inspect its metadata and AI analysis.</p>
                      </div>
                    )}
                  </Card>
                </div>
              ) : (
                <Card className="p-12 text-center bg-card border-border border-dashed shadow-sm">
                  <div className="flex flex-col items-center gap-4 max-w-md mx-auto py-4">
                    <div className="p-4 rounded-full bg-secondary text-primary"><FolderTree className="h-10 w-10" /></div>
                    <div className="space-y-1.5">
                      <h3 className="text-xl font-bold text-foreground">No Repository Open</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">Enter an absolute repository path above to explore the code tree.</p>
                    </div>
                    <Button onClick={() => handleOpen("/home/ksk/AI-Git-assistand/frontend")} disabled={isLoading} className="gap-2 mt-2 px-6 h-11">
                      <Play className="h-4 w-4 fill-current" /><span>Open Workspace Repository</span>
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === "git" && (
            <Card className="p-8 bg-card border-border shadow-sm space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Git Source Control Details</h3>
              {repository ? (
                <div className="space-y-4 text-sm pt-2">
                  <div className="flex items-center gap-2"><strong className="w-36 text-muted-foreground">Name:</strong> <span>{repository.name}</span></div>
                  <div className="flex items-center gap-2"><strong className="w-36 text-muted-foreground">Current Branch:</strong> <Badge variant="secondary" className="px-3 py-1 font-mono">{repository.current_branch || "main"}</Badge></div>
                  <div className="flex items-center gap-2"><strong className="w-36 text-muted-foreground">HEAD Commit:</strong> <code className="text-emerald-400 font-mono bg-secondary px-3 py-1.5 rounded-md border border-border">{repository.head_commit || "—"}</code></div>
                  <div className="flex items-center gap-2"><strong className="w-36 text-muted-foreground">Total Indexed Files:</strong> <span>{repository.file_count} files</span></div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">No repository currently connected.</p>
                  <Button
                    onClick={() => handleOpen("/home/ksk/AI-Git-assistand/frontend")}
                    disabled={isLoading}
                    variant="outline"
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    <span>Connect Workspace Repository</span>
                  </Button>
                </div>
              )}
            </Card>
          )}

          {(activeTab === "ai" || activeTab === "ai-agent") && (
            <AIAgentPage repository={repository} />
          )}



          {activeTab === "settings" && (
            <Card className="p-8 space-y-4 bg-card border-border shadow-sm">
              <h3 className="text-lg font-semibold text-foreground">Preferences</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Customize layout, sidebar collapsible modes, and dark/light zinc visual theme tokens.
              </p>
            </Card>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

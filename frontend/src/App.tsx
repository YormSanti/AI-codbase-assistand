import { useState } from "react";
import "./App.css";
import { repositoryApi } from "./api/repositoryApi";
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

import type { RepositoryInfo, TreeNode } from "./types/domain";
import { AlertCircle } from "lucide-react";


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

        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", minHeight: 0, overflowY: "auto", backgroundColor: "var(--background)" }}>
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
              onOpen={handleOpen}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {/* File Explorer */}
          {activeTab === "explorer" && (
            <ExplorerPage
              repository={repository}
              tree={tree}
              selectedFile={selectedFile}
              isLoading={isLoading}
              onOpen={handleOpen}
              onSelectFile={handleSelectFile}
              onCloseFile={() => setSelectedFile(null)}
            />
          )}

          {/* Terminal */}
          {activeTab === "terminal" && (
            <TerminalPage />
          )}

          {/* Git Repository */}
          {activeTab === "git" && (
            <GitPage
              repository={repository}
              isLoading={isLoading}
              onOpen={handleOpen}
            />
          )}

          {/* AI Agent */}
          {(activeTab === "ai" || activeTab === "ai-agent") && (
            <AIAgentPage repository={repository} />
          )}

          {/* Analytics */}
          {activeTab === "analytics" && (
            <AnalyticsPage
              repository={repository}
              tree={tree}
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

import { FolderTree, GitBranch, Sparkles, Settings } from "lucide-react";

export type ActiveTab = "dashboard" | "projects" | "explorer" | "git" | "ai" | "settings" | "analytics" | "terminal";

export function ActivityBar({
  activeTab,
  onSelectTab,
  hasRepository,
}: {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  hasRepository: boolean;
}) {
  return (
    <aside className="activity-bar">
      <div className="activity-bar-top">
        <div className="activity-logo" title="IFROG DevPilot">
          <img src="/logo.png" alt="Logo" style={{ width: "20px", height: "20px", borderRadius: "4px", objectFit: "cover" }} />
        </div>

        <button
          type="button"
          className={`activity-btn ${activeTab === "explorer" ? "activity-btn--active" : ""}`}
          onClick={() => onSelectTab("explorer")}
          title="File Explorer (Files & Folders)"
          aria-label="File Explorer"
        >
          <FolderTree className="h-5 w-5" />
          <span className="activity-tooltip">Explorer</span>
        </button>

        <button
          type="button"
          className={`activity-btn ${activeTab === "git" ? "activity-btn--active" : ""}`}
          onClick={() => onSelectTab("git")}
          title="Git & Branches"
          aria-label="Git Source Control"
        >
          <GitBranch className="h-5 w-5" />
          <span className="activity-tooltip">Git Repository</span>
          {hasRepository && <span className="activity-dot" />}
        </button>

        <button
          type="button"
          className={`activity-btn ${activeTab === "ai" ? "activity-btn--active" : ""}`}
          onClick={() => onSelectTab("ai")}
          title="DevPilot AI Insights"
          aria-label="AI Intelligence"
        >
          <Sparkles className="h-5 w-5" />
          <span className="activity-tooltip">AI Intelligence</span>
        </button>
      </div>

      <div className="activity-bar-bottom">
        <button
          type="button"
          className={`activity-btn ${activeTab === "settings" ? "activity-btn--active" : ""}`}
          onClick={() => onSelectTab("settings")}
          title="Settings & Theme"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
          <span className="activity-tooltip">Settings</span>
        </button>
      </div>
    </aside>
  );
}

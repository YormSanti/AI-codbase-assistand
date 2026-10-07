import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/ThemeToggle"

const VIEW_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  explorer: "File Explorer",
  editor: "Code Editor",
  terminal: "Terminal",
  git: "Git Repository",
  ai: "AI Agent Studio",
  analytics: "Code Analytics & Charts",
  chart: "Code Analytics & Charts",
  charts: "Code Analytics & Charts",
  settings: "Settings",
};

export function SiteHeader({
  hasRepository = false,
  currentView = "dashboard",
}: {
  hasRepository?: boolean;
  currentView?: string;
}) {
  const label = VIEW_LABELS[currentView] ?? currentView;

  return (
    <header style={{
      display: "flex",
      height: "56px",
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      borderBottom: "1px solid var(--border)",
      background: "var(--background)",
      backdropFilter: "blur(12px)",
      padding: "0 20px",
      position: "sticky",
      top: 0,
      zIndex: 40,
    }}>
      {/* Left: sidebar trigger + view label */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
        <SidebarTrigger style={{ color: "var(--muted-foreground)" }} />
        <div style={{ width: "1px", height: "18px", flexShrink: 0, background: "var(--border)" }} />
        <h1 className="truncate" title={label} style={{
          margin: 0,
          fontSize: "13px",
          fontWeight: "700",
          color: "var(--foreground)",
          letterSpacing: "0.1px",
        }}>
          {label}
        </h1>
      </div>

      {/* Right: status badge + theme toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
        {/* Repo status pill */}
        <div className="hidden sm:flex" style={{
          alignItems: "center",
          gap: "7px",
          padding: "6px 14px",
          borderRadius: "99px",
          background: hasRepository ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.05)",
          border: `1.5px solid ${hasRepository ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.12)"}`,
        }}>
          <span style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: hasRepository ? "#10b981" : "rgba(255,255,255,0.3)",
            boxShadow: hasRepository ? "0 0 8px #10b981" : "none",
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: "12px",
            fontWeight: "700",
            color: hasRepository ? "#34d399" : "var(--muted-foreground)",
            userSelect: "none",
          }}>
            {hasRepository ? "Repo Connected" : "Ready"}
          </span>
        </div>

        <ThemeToggle />
      </div>
    </header>
  )
}

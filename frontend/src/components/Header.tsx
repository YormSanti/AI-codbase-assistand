import { CheckCircle2, Circle } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Badge } from "./ui/badge";

export function Header({ hasRepository }: { hasRepository: boolean }) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="logo-badge" style={{ padding: 0, overflow: "hidden" }}>
          <img src="/logo.png" alt="IFROG Logo" style={{ width: "24px", height: "24px", objectFit: "cover", borderRadius: "6px" }} />
        </div>
        <div className="brand-text">
          <h1 className="brand-title">
            DevPilot <span className="brand-highlight">AI</span>
          </h1>
          <p className="subtitle">Developer Intelligence Platform</p>
        </div>
      </div>

      <div className="header-actions">
        <Badge variant={hasRepository ? "default" : "secondary"} className="status-badge">
          {hasRepository ? (
            <>
              <CheckCircle2 className="status-icon status-icon--active" />
              <span>Repo Connected</span>
            </>
          ) : (
            <>
              <Circle className="status-icon" />
              <span>Ready</span>
            </>
          )}
        </Badge>
        <ThemeToggle />
      </div>
    </header>
  );
}

import { useState } from "react";
import { FolderGit2, GitBranch, GitCommit, Files, Copy, Check } from "lucide-react";
import type { RepositoryInfo } from "../types/domain";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function RepositorySummary({ repository }: { repository: RepositoryInfo }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const shortCommit = repository.head_commit ? repository.head_commit.slice(0, 7) : "—";

  return (
    <Card className="repository-summary">
      <div className="summary-header">
        <div className="repo-title-wrapper">
          <FolderGit2 className="repo-icon text-muted-foreground" />
          <div>
            <h2 className="repo-name">{repository.name}</h2>
            <span className="repo-path" title={repository.root_path}>
              {repository.root_path}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyToClipboard(repository.root_path, "path")}
          title="Copy repository path"
        >
          {copiedKey === "path" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copiedKey === "path" ? "Copied" : "Copy Path"}</span>
        </Button>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="card-label">
            <GitBranch className="card-icon" />
            <span>Current Branch</span>
          </div>
          <div className="card-value">
            <Badge variant="secondary" className="branch-badge">
              {repository.current_branch ?? "—"}
            </Badge>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-label">
            <GitCommit className="card-icon" />
            <span>HEAD Commit</span>
          </div>
          <div className="card-value card-value--commit">
            <code>{shortCommit}</code>
            {repository.head_commit && (
              <button
                type="button"
                className="mini-copy-btn"
                onClick={() => copyToClipboard(repository.head_commit!, "commit")}
                title="Copy commit hash"
              >
                {copiedKey === "commit" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            )}
          </div>
        </div>

        <div className="summary-card">
          <div className="card-label">
            <Files className="card-icon" />
            <span>Indexed Files</span>
          </div>
          <div className="card-value">
            <Badge variant="outline" className="count-badge">
              {repository.file_count} files
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}

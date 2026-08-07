import { useState } from "react";
import { FileText, Copy, Check, X } from "lucide-react";
import type { TreeNode } from "../types/domain";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FileInspector({
  file,
  onClose,
}: {
  file: TreeNode;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyPath = () => {
    navigator.clipboard.writeText(file.path).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className="file-inspector">
      <div className="inspector-header">
        <div className="inspector-title">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="file-name">{file.name}</span>
          {file.language && file.language !== "other" && (
            <Badge variant="secondary" className="lang-badge">
              {file.language}
            </Badge>
          )}
        </div>
        <div className="inspector-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyPath}
            title="Copy file path"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Copied" : "Copy Path"}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            title="Close file preview"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="inspector-body">
        <div className="inspector-meta">
          <div className="meta-item">
            <span className="meta-label">Path</span>
            <code className="meta-value">{file.path || file.name}</code>
          </div>
          <div className="meta-item">
            <span className="meta-label">Size</span>
            <span className="meta-value">{formatBytes(file.size_bytes)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Language</span>
            <span className="meta-value">{file.language || "Plain Text"}</span>
          </div>
        </div>

        <div className="preview-pane">
          <div className="preview-header">
            <span>File Details</span>
            <Badge variant="outline" className="preview-info">
              Ready for AI analysis
            </Badge>
          </div>
          <div className="preview-content">
            <p className="preview-placeholder">
              Selected <strong>{file.name}</strong> ({formatBytes(file.size_bytes)}).
            </p>
            <p className="preview-subtext">
              DevPilot AI is ready to index, generate diffs, or analyze symbols for this file.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

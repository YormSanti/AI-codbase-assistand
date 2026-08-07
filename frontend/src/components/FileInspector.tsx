import { useState } from "react";
import { FileText, Copy, Check, X, Code, Cpu } from "lucide-react";
import type { TreeNode } from "../types/domain";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

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
    <div className="inspector-card flex flex-col h-full gap-4">
      <div className="inspector-header flex items-center justify-between border-b border-border pb-3">
        <div className="inspector-title flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-400" />
          <span className="file-name font-mono font-bold text-sm">{file.name}</span>
          {file.language && file.language !== "other" && (
            <Badge variant="secondary" className="uppercase font-mono text-[10px] tracking-wider bg-blue-500/10 text-blue-300 border-blue-500/30">
              {file.language}
            </Badge>
          )}
        </div>
        <div className="inspector-actions flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyPath}
            title="Copy file path"
            className="h-8 gap-1.5 text-xs font-mono"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Copied" : "Copy Path"}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            title="Close file preview"
            className="size-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="inspector-details flex flex-col gap-2 text-xs">
        <div className="inspector-row flex items-center justify-between p-2.5 bg-secondary/40 rounded-lg border border-border/50">
          <span className="inspector-label text-muted-foreground font-medium">Path</span>
          <code className="inspector-value font-mono text-foreground truncate max-w-[280px]" title={file.path}>{file.path || file.name}</code>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="inspector-row flex items-center justify-between p-2.5 bg-secondary/40 rounded-lg border border-border/50">
            <span className="inspector-label text-muted-foreground font-medium">File Size</span>
            <span className="inspector-value font-mono text-foreground">{formatBytes(file.size_bytes)}</span>
          </div>
          <div className="inspector-row flex items-center justify-between p-2.5 bg-secondary/40 rounded-lg border border-border/50">
            <span className="inspector-label text-muted-foreground font-medium">Language</span>
            <span className="inspector-value font-mono text-foreground capitalize">{file.language || "Plain Text"}</span>
          </div>
        </div>
      </div>

      <div className="preview-pane flex-1 flex flex-col border border-border/50 rounded-lg bg-secondary/20 overflow-hidden mt-1">
        <div className="preview-header flex items-center justify-between px-3 py-2 border-b border-border/40 bg-secondary/40 text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <Code className="h-3.5 w-3.5 text-purple-400" />
            <span>AST & Symbol Inspection</span>
          </div>
          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
            Ready for Analysis
          </Badge>
        </div>
        <div className="preview-content p-6 flex flex-col items-center justify-center text-center gap-3 flex-1 text-muted-foreground">
          <div className="p-3 rounded-full bg-secondary border border-border">
            <Cpu className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h5 className="text-sm font-semibold text-foreground mb-1">AST Analysis Ready</h5>
            <p className="text-xs max-w-xs leading-relaxed">
              DevPilot AI is tracking symbol definitions and cross-file dependencies for <strong className="text-foreground font-mono">{file.name}</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

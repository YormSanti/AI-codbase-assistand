import { useState, useMemo, useEffect, useRef } from "react";
import { Folder, FolderOpen, FileCode, Search, X, ChevronRight, ChevronDown, FileJson, FileText, Code2, FileSpreadsheet } from "lucide-react";
import type { TreeNode } from "../types/domain";
import { Input } from "./ui/input";

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename: string, language?: string | null) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "json") return <FileJson className="tree-icon text-yellow-400 h-4 w-4 shrink-0" />;
  if (ext === "md" || ext === "txt") return <FileText className="tree-icon text-emerald-400 h-4 w-4 shrink-0" />;
  if (ext === "tsx" || ext === "jsx") return <Code2 className="tree-icon text-cyan-400 h-4 w-4 shrink-0" />;
  if (ext === "ts" || ext === "js") return <FileCode className="tree-icon text-blue-400 h-4 w-4 shrink-0" />;
  if (ext === "css" || ext === "scss") return <FileSpreadsheet className="tree-icon text-pink-400 h-4 w-4 shrink-0" />;
  if (language === "python" || ext === "py") return <FileCode className="tree-icon text-amber-400 h-4 w-4 shrink-0" />;
  if (language === "rust" || ext === "rs") return <FileCode className="tree-icon text-orange-400 h-4 w-4 shrink-0" />;
  if (language === "go") return <FileCode className="tree-icon text-teal-400 h-4 w-4 shrink-0" />;
  return <FileCode className="tree-icon text-muted-foreground h-4 w-4 shrink-0" />;
}

function TreeNodeItem({
  node,
  depth,
  searchQuery,
  onSelectFile,
  selectedFilePath,
}: {
  node: TreeNode;
  depth: number;
  searchQuery: string;
  onSelectFile?: (node: TreeNode) => void;
  selectedFilePath?: string;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  const isSearching = searchQuery.trim().length > 0;
  const isExpandedEffective = isSearching ? true : expanded;

  if (!node.is_directory) {
    const isSelected = selectedFilePath === node.path;
    return (
      <li
        className={`tree-row tree-row--file ${isSelected ? "tree-row--selected" : ""}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => onSelectFile?.(node)}
      >
        {getFileIcon(node.name, node.language)}
        <span className="tree-name font-mono">{node.name}</span>
        {node.size_bytes !== null && (
          <span className="tree-size">{formatBytes(node.size_bytes)}</span>
        )}
        {node.language && node.language !== "other" && (
          <span className={`tree-language lang-${node.language}`}>{node.language}</span>
        )}
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        className="tree-row tree-row--dir"
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={isExpandedEffective}
      >
        <span className="tree-chevron" aria-hidden>
          {isExpandedEffective ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </span>
        <span className="tree-icon" aria-hidden>
          {isExpandedEffective ? <FolderOpen className="h-4 w-4 text-amber-400 shrink-0" /> : <Folder className="h-4 w-4 text-amber-400/80 shrink-0" />}
        </span>
        <span className="tree-name font-medium">{node.name || "/"}</span>
        <span className="tree-count text-xs text-muted-foreground">({node.children.length})</span>
      </button>
      {isExpandedEffective && node.children.length > 0 && (
        <ul className="tree-list">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path || child.name}
              node={child}
              depth={depth + 1}
              searchQuery={searchQuery}
              onSelectFile={onSelectFile}
              selectedFilePath={selectedFilePath}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function filterTree(node: TreeNode, query: string): TreeNode | null {
  if (!query) return node;
  const q = query.toLowerCase();
  
  if (!node.is_directory) {
    return node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)
      ? node
      : null;
  }

  const filteredChildren = node.children
    .map((child) => filterTree(child, query))
    .filter((child): child is TreeNode => child !== null);

  if (filteredChildren.length > 0 || node.name.toLowerCase().includes(q)) {
    return {
      ...node,
      children: filteredChildren,
    };
  }

  return null;
}

export function RepositoryTree({
  root,
  onSelectFile,
  selectedFilePath,
}: {
  root: TreeNode;
  onSelectFile?: (node: TreeNode) => void;
  selectedFilePath?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredRoot = useMemo(() => {
    return filterTree(root, searchQuery) ?? { ...root, children: [] };
  }, [root, searchQuery]);

  return (
    <div className="tree-container">
      <div className="tree-toolbar">
        <div className="tree-search-wrapper">
          <Search className="search-icon h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            className="tree-search-input pr-12"
            placeholder="Filter files... (Press '/' to search)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Filter repository files"
          />
          {searchQuery ? (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
              title="Clear search filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="absolute right-2.5 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              /
            </kbd>
          )}
        </div>
      </div>

      <ul className="tree-list tree-root border border-border/50 rounded-lg p-2 bg-secondary/20" data-testid="repository-tree">
        <TreeNodeItem
          node={filteredRoot}
          depth={0}
          searchQuery={searchQuery}
          onSelectFile={onSelectFile}
          selectedFilePath={selectedFilePath}
        />
      </ul>
    </div>
  );
}

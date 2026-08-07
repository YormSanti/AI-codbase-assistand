import { useState, useMemo } from "react";
import { Folder, FolderOpen, FileCode, Search, X, ChevronRight, ChevronDown } from "lucide-react";
import type { TreeNode } from "../types/domain";
import { Input } from "./ui/input";

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        <FileCode className="tree-icon text-muted-foreground h-4 w-4" />
        <span className="tree-name">{node.name}</span>
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
          {isExpandedEffective ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
        <span className="tree-icon" aria-hidden>
          {isExpandedEffective ? <FolderOpen className="h-4 w-4 text-accent-foreground" /> : <Folder className="h-4 w-4 text-muted-foreground" />}
        </span>
        <span className="tree-name">{node.name || "/"}</span>
        <span className="tree-count">({node.children.length})</span>
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

  const filteredRoot = useMemo(() => {
    return filterTree(root, searchQuery) ?? { ...root, children: [] };
  }, [root, searchQuery]);

  return (
    <div className="tree-container">
      <div className="tree-toolbar">
        <div className="tree-search-wrapper">
          <Search className="search-icon h-3.5 w-3.5" />
          <Input
            className="tree-search-input"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Filter repository files"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
              title="Clear search filter"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <ul className="tree-list tree-root" data-testid="repository-tree">
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

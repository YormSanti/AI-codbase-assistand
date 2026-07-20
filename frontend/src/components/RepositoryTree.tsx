import { useState } from "react";
import type { TreeNode } from "../types/domain";

function TreeNodeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (!node.is_directory) {
    return (
      <li className="tree-row tree-row--file" style={{ paddingLeft: depth * 16 }}>
        <span className="tree-icon" aria-hidden>
          📄
        </span>
        <span className="tree-name">{node.name}</span>
        {node.language && node.language !== "other" && (
          <span className="tree-language">{node.language}</span>
        )}
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        className="tree-row tree-row--dir"
        style={{ paddingLeft: depth * 16 }}
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="tree-icon" aria-hidden>
          {expanded ? "📂" : "📁"}
        </span>
        <span className="tree-name">{node.name || "/"}</span>
        <span className="tree-count">({node.children.length})</span>
      </button>
      {expanded && node.children.length > 0 && (
        <ul className="tree-list">
          {node.children.map((child) => (
            <TreeNodeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function RepositoryTree({ root }: { root: TreeNode }) {
  return (
    <ul className="tree-list tree-root" data-testid="repository-tree">
      <TreeNodeItem node={root} depth={0} />
    </ul>
  );
}

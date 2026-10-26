import { useMemo, useState } from "react";
import { splitGitDiff, type DiffLine } from "./gitDiff";

const PAGE = 2000;

function DiffCell({ line, side }: { line: DiffLine | null; side: "old" | "new" }) {
  return <div className={`editor-git-diff-cell ${line ? `is-${line.kind}` : "is-empty"}`}><span className="editor-git-line-number">{line?.[side === "old" ? "oldLine" : "newLine"]}</span><code>{line?.text ?? " "}</code></div>;
}

interface Props {
  lines: DiffLine[];
  layout: "split" | "unified";
  /** Column titles for the split view, old side first. */
  labels: [string, string];
  /** Git cut the patch at its size limit. */
  truncated?: boolean;
  label?: string;
}

/** Split or unified rendering of parsed diff lines, paged so huge patches stay responsive. Remount (key) per file. */
export function DiffView({ lines, layout, labels, truncated = false, label = "File diff" }: Props) {
  const [lineLimit, setLineLimit] = useState(PAGE);
  const visibleLines = useMemo(() => lines.slice(0, lineLimit), [lines, lineLimit]);
  const splitLines = useMemo(() => layout === "split" ? splitGitDiff(visibleLines) : [], [layout, visibleLines]);
  return (
    <div className="editor-git-diff-scroll" role="region" aria-label={label} tabIndex={0}>
      {layout === "split"
        ? <div className="editor-git-split"><div className="editor-git-pane-label">{labels[0]}</div><div className="editor-git-pane-label">{labels[1]}</div>{splitLines.map((row, index) => row.note ? <div key={index} className={`editor-git-diff-note is-${row.note.kind}`}>{row.note.text}</div> : <div key={index} className="editor-git-split-row"><DiffCell line={row.left} side="old" /><DiffCell line={row.right} side="new" /></div>)}</div>
        : <div className="editor-git-unified">{visibleLines.map((line, index) => <div key={index} className={`editor-git-unified-line is-${line.kind}`}><span className="editor-git-line-number">{line.oldLine}</span><span className="editor-git-line-number">{line.newLine}</span><span className="editor-git-line-sign">{line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}</span><code>{line.text}</code></div>)}</div>}
      {(truncated || lines.length > lineLimit) && <div className="editor-git-diff-limit">{lines.length > lineLimit ? <><span>Showing {lineLimit.toLocaleString()} of {lines.length.toLocaleString()} diff lines</span><button type="button" onClick={() => setLineLimit(value => value + PAGE)}>Show more</button></> : <span>This diff was truncated by Git preview limits.</span>}</div>}
    </div>
  );
}

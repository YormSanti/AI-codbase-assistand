import { useMemo, useRef } from "react";

interface Props {
  value: string;
  line: number;
  onGoToLine: (line: number) => void;
}

export function EditorMinimap({ value, line, onGoToLine }: Props) {
  const previewRef = useRef<SVGSVGElement>(null);
  const lines = useMemo(() => value.split("\n"), [value]);
  const stride = Math.max(1, Math.ceil(lines.length / 200));
  const samples = useMemo(() => lines.filter((_, index) => index % stride === 0), [lines, stride]);
  const height = samples.length * 3 + 6;
  return <button type="button" className="vscode-minimap" aria-label="Code minimap" title="Click the minimap to go to a line" onClick={event => {
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!bounds?.height) return;
    const target = event.detail === 0 ? line : Math.floor((event.clientY - bounds.top) / bounds.height * samples.length) * stride + 1;
    onGoToLine(Math.max(1, Math.min(lines.length, target)));
  }}>
    <svg ref={previewRef} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ height: Math.min(height, 500) }} aria-hidden="true">
      <rect x="0" y={Math.max(0, (line - 1) / stride * 3)} width="100" height="3" fill="var(--editor-selection)" />
      {samples.map((text, index) => <text key={index} x="3" y={index * 3 + 3} fill={/^\s*(\/\/|#|\*)/.test(text) ? "var(--editor-comment)" : "var(--editor-muted)"}>{text.replace(/\t/g, "    ").slice(0, 120)}</text>)}
    </svg>
  </button>;
}

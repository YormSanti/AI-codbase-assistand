export interface DiffLine {
  kind: "added" | "removed" | "context" | "hunk" | "meta";
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

export function parseGitDiff(content: string): DiffLine[] {
  let oldLine = 0, newLine = 0, inHunk = false;
  return content.split("\n").filter((text, index, all) => text !== "" || index !== all.length - 1).map(text => {
    if (text.startsWith("diff --")) inHunk = false;
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) { oldLine = Number(hunk[1]); newLine = Number(hunk[2]); inHunk = true; }
    if (text.startsWith("@@@")) inHunk = false;
    if (text.startsWith("@@")) return { kind: "hunk", oldLine: null, newLine: null, text };
    if (inHunk && text.startsWith("+")) return { kind: "added", oldLine: null, newLine: newLine++, text: text.slice(1) };
    if (inHunk && text.startsWith("-")) return { kind: "removed", oldLine: oldLine++, newLine: null, text: text.slice(1) };
    if (inHunk && text.startsWith(" ")) return { kind: "context", oldLine: oldLine++, newLine: newLine++, text: text.slice(1) };
    return { kind: "meta", oldLine: null, newLine: null, text };
  });
}

export function splitGitDiff(lines: DiffLine[]): { left: DiffLine | null; right: DiffLine | null; note?: DiffLine }[] {
  const result: ReturnType<typeof splitGitDiff> = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (line.kind === "removed" || line.kind === "added") {
      const removed: DiffLine[] = [], added: DiffLine[] = [];
      while (index < lines.length && lines[index].kind === "removed") removed.push(lines[index++]);
      while (index < lines.length && lines[index].kind === "added") added.push(lines[index++]);
      for (let row = 0; row < Math.max(removed.length, added.length); row++) result.push({ left: removed[row] ?? null, right: added[row] ?? null });
    } else {
      result.push(line.kind === "context" ? { left: line, right: line } : { left: null, right: null, note: line });
      index++;
    }
  }
  return result;
}

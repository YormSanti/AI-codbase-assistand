import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Binary,
  Braces,
  Check,
  ChevronRight,
  Copy,
  FileCode2,
  LoaderCircle,
  MessageSquareCode,
  Search,
  X,
} from "lucide-react";
import { fileApi } from "../api/fileApi";
import { ApiError } from "../api/client";
import type { CodeSymbol, FilePreview, SymbolKind, TreeNode } from "../types/domain";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const symbolLabels: Record<SymbolKind, string> = {
  class: "C",
  function: "ƒ",
  method: "m",
  import: "→",
};

const symbolColors: Record<SymbolKind, string> = {
  class: "text-violet-300 bg-violet-500/10 border-violet-500/25",
  function: "text-blue-300 bg-blue-500/10 border-blue-500/25",
  method: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  import: "text-amber-300 bg-amber-500/10 border-amber-500/25",
};

export function FileInspector({
  file,
  onClose,
  onAskAI,
}: {
  file: TreeNode;
  onClose: () => void;
  onAskAI?: (file: TreeNode) => void;
}) {
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [symbols, setSymbols] = useState<CodeSymbol[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const sourceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setPreview(null);
    setSymbols([]);
    setSymbolQuery("");
    setActiveLine(null);

    if (file.file_id === null) {
      setError("This file has not been indexed yet.");
      setIsLoading(false);
      return () => { active = false; };
    }

    Promise.all([fileApi.getContent(file.file_id), fileApi.getSymbols(file.file_id)])
      .then(([content, fileSymbols]) => {
        if (!active) return;
        setPreview(content);
        setSymbols(fileSymbols);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof ApiError ? requestError.message : "Could not load this file.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [file.file_id]);

  const lines = useMemo(() => preview?.content?.split("\n") ?? [], [preview?.content]);
  const filteredSymbols = useMemo(() => {
    const query = symbolQuery.trim().toLowerCase();
    return query
      ? symbols.filter((symbol) =>
          symbol.name.toLowerCase().includes(query) || symbol.kind.includes(query),
        )
      : symbols;
  }, [symbolQuery, symbols]);

  const handleCopyPath = async () => {
    await navigator.clipboard.writeText(file.path);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const jumpToLine = (line: number) => {
    setActiveLine(line);
    sourceRef.current
      ?.querySelector<HTMLElement>(`[data-line="${line}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card" aria-label={`Inspect ${file.name}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <FileCode2 className="h-4 w-4 shrink-0 text-blue-400" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-sm font-semibold text-foreground">{file.name}</span>
              {file.language && file.language !== "other" && (
                <Badge variant="secondary" className="h-5 border-blue-500/20 bg-blue-500/10 px-1.5 font-mono text-[9px] uppercase text-blue-300">
                  {file.language}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={file.path}>{file.path}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onAskAI && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onAskAI(file)}>
              <MessageSquareCode className="h-3.5 w-3.5 text-violet-400" />
              Ask AI
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-8" onClick={() => void handleCopyPath()} title="Copy relative path">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose} title="Close file preview">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex items-center gap-4 border-b border-border bg-secondary/30 px-4 py-2 text-[11px] text-muted-foreground">
        <span>{formatBytes(file.size_bytes)}</span>
        <span>{lines.length ? `${lines.length.toLocaleString()} lines` : "No source loaded"}</span>
        <span>{symbols.length} {symbols.length === 1 ? "symbol" : "symbols"}</span>
        {preview?.truncated && <span className="text-amber-300">Preview limited to 500 KB</span>}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin text-blue-400" />
          Loading source and symbols…
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <AlertCircle className="h-7 w-7 text-rose-400" />
          <div>
            <p className="text-sm font-medium text-foreground">Preview unavailable</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : preview?.is_binary ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Binary className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Binary file</p>
            <p className="mt-1 text-xs text-muted-foreground">Source preview is disabled for binary content.</p>
          </div>
        </div>
      ) : (
        <div className="file-inspector-grid min-h-0 flex-1">
          <div ref={sourceRef} className="min-h-0 overflow-auto bg-background py-2 font-mono text-[12px] leading-5" role="region" aria-label="Source code">
            {lines.map((line, index) => {
              const lineNumber = index + 1;
              return (
                <div
                  key={lineNumber}
                  data-line={lineNumber}
                  className={`flex min-w-max border-l-2 ${activeLine === lineNumber ? "border-blue-400 bg-blue-500/10" : "border-transparent"}`}
                >
                  <button
                    type="button"
                    className="w-14 shrink-0 select-none pr-3 text-right text-zinc-600 hover:text-zinc-300"
                    onClick={() => setActiveLine(lineNumber)}
                    aria-label={`Line ${lineNumber}`}
                  >
                    {lineNumber}
                  </button>
                  <code className="whitespace-pre pr-6 text-foreground/85">{line || " "}</code>
                </div>
              );
            })}
            {lines.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">This file is empty.</p>}
          </div>

          <aside className="flex min-h-0 flex-col border-l border-border bg-card" aria-label="Symbol outline">
            <div className="border-b border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Braces className="h-3.5 w-3.5 text-violet-400" /> Outline
                </span>
                <span className="text-[10px] text-muted-foreground">{filteredSymbols.length}</span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={symbolQuery}
                  onChange={(event) => setSymbolQuery(event.target.value)}
                  placeholder="Filter symbols"
                  className="h-8 pl-8 text-xs"
                  aria-label="Filter symbols"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              {filteredSymbols.map((symbol) => (
                <button
                  type="button"
                  key={symbol.id}
                  onClick={() => jumpToLine(symbol.start_line)}
                  className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border font-mono text-[10px] ${symbolColors[symbol.kind]}`}>
                    {symbolLabels[symbol.kind]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[11px] text-foreground" title={symbol.name}>{symbol.name}</span>
                    <span className="block text-[9px] capitalize text-muted-foreground">{symbol.kind} · line {symbol.start_line}</span>
                  </span>
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
              {filteredSymbols.length === 0 && (
                <p className="px-2 py-6 text-center text-[11px] leading-4 text-muted-foreground">
                  {symbols.length ? "No matching symbols." : "No named symbols were found."}
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

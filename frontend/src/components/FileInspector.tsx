import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  Pencil,
  Save,
  Search,
  X,
} from "lucide-react";
import { fileApi } from "../api/fileApi";
import { editorApi } from "../api/editorApi";
import { ApiError } from "../api/client";
import type { CodeSymbol, FilePreview, SymbolKind, TreeNode } from "../types/domain";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAppSettings } from "../hooks/useAppSettings";
import type { CodeEditorHandle } from "./CodeEditorSurface";

const CodeEditorSurface = lazy(async () => ({ default: (await import("./CodeEditorSurface")).CodeEditorSurface }));

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
  onEditorStateChange,
  onSaved,
  readOnly = false,
  autoEdit = false,
  openFiles,
  onSelectOpenFile,
  onCloseOpenFile,
  outlineVisible = true,
  localRepositoryId,
}: {
  file: TreeNode;
  onClose: () => void;
  onAskAI?: (file: TreeNode) => void;
  onEditorStateChange?: (state: { dirty: boolean; saving: boolean }) => void;
  onSaved?: (preview: FilePreview) => void;
  readOnly?: boolean;
  autoEdit?: boolean;
  openFiles?: TreeNode[];
  onSelectOpenFile?: (file: TreeNode) => void;
  onCloseOpenFile?: (file: TreeNode) => void;
  outlineVisible?: boolean;
  localRepositoryId?: number;
}) {
  const { settings } = useAppSettings();
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [symbols, setSymbols] = useState<CodeSymbol[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const savingRef = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const codeEditorRef = useRef<CodeEditorHandle>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const baseline = preview?.content?.replace(/\r\n/g, "\n") ?? "";
  const isDirty = isEditing && draft !== baseline;
  const canEdit = preview?.editable === true && Boolean(preview.content_hash);
  const editorStatusRef = useRef({ dirty: false, saving: false });
  editorStatusRef.current = { dirty: isDirty, saving: isSaving };

  useEffect(() => {
    onEditorStateChange?.({ dirty: isDirty, saving: isSaving });
  }, [isDirty, isSaving, onEditorStateChange]);

  useEffect(() => () => {
    onEditorStateChange?.({ dirty: false, saving: false });
  }, [onEditorStateChange]);

  useEffect(() => {
    if (!isDirty && !isSaving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty, isSaving]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let active = true;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => getCurrentWindow().onCloseRequested((event) => {
        if (!active) return;
        const status = editorStatusRef.current;
        if (status.saving || (status.dirty && !window.confirm("Discard your unsaved changes and close the app?"))) {
          event.preventDefault();
        }
      }))
      .then((stopListening) => { if (active) unlisten = stopListening; else stopListening(); })
      .catch((requestError) => console.error("Could not register the editor close guard", requestError));
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setPreview(null);
    setSymbols([]);
    setSymbolQuery("");
    setActiveLine(null);
    setCursor({ line: 1, column: 1 });
    setIsEditing(false);
    setDraft("");
    setSaveError(null);
    setSaveNotice(null);

    if (file.file_id === null) {
      setError("This file has not been indexed yet.");
      setIsLoading(false);
      return () => { active = false; };
    }

    Promise.all(localRepositoryId !== undefined
      ? [editorApi.getContent(localRepositoryId, file.path), editorApi.getSymbols(localRepositoryId, file.path)]
      : [fileApi.getContent(file.file_id), fileApi.getSymbols(file.file_id)])
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
  }, [file.file_id, file.path, localRepositoryId]);

  useEffect(() => {
    if (autoEdit && canEdit && !isEditing) {
      setDraft(baseline);
      setIsEditing(true);
    }
  }, [autoEdit, canEdit, isEditing, baseline]);

  const lines = useMemo(() => preview?.content?.split("\n") ?? [], [preview?.content]);
  const draftLines = useMemo(() => draft.split("\n"), [draft]);
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
    if (autoEdit && isEditing) {
      codeEditorRef.current?.goToLine(line);
      return;
    }
    if (isEditing && editorRef.current) {
      const offset = draft.split("\n").slice(0, line - 1).reduce((total, row) => total + row.length + 1, 0);
      editorRef.current.focus();
      editorRef.current.setSelectionRange(offset, offset);
      editorRef.current.scrollTop = Math.max(0, (line - 3) * 20);
      if (gutterRef.current) gutterRef.current.scrollTop = editorRef.current.scrollTop;
      return;
    }
    sourceRef.current
      ?.querySelector<HTMLElement>(`[data-line="${line}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const discardEdits = () => {
    if (savingRef.current || (isDirty && !window.confirm("Discard your unsaved changes?"))) return;
    setDraft(baseline);
    setIsEditing(autoEdit);
    setSaveError(null);
    setSaveNotice(null);
  };

  const closeFile = () => {
    if (savingRef.current || (isDirty && !window.confirm("Discard your unsaved changes and close this file?"))) return;
    onEditorStateChange?.({ dirty: false, saving: false });
    onClose();
  };

  const handleSave = async () => {
    if (!isDirty || !canEdit || !preview?.content_hash || file.file_id === null || savingRef.current || readOnly) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    // Textareas use LF internally; retain an existing CRLF file's line endings.
    const usesCRLF = preview.content?.includes("\r\n") && !preview.content.replace(/\r\n/g, "").includes("\n");
    const content = usesCRLF ? draft.replace(/\n/g, "\r\n") : draft;
    try {
      const saved = localRepositoryId !== undefined
        ? await editorApi.saveContent(localRepositoryId, file.path, content, preview.content_hash)
        : await fileApi.saveContent(file.file_id, content, preview.content_hash);
      setPreview(saved);
      setDraft(saved.content?.replace(/\r\n/g, "\n") ?? "");
      onSaved?.(saved);
      setSaveNotice("Saved to disk.");
      try {
        setSymbols(localRepositoryId !== undefined
          ? await editorApi.getSymbols(localRepositoryId, file.path)
          : await fileApi.getSymbols(file.file_id));
      } catch {
        setSaveNotice("Saved to disk. Reopen the file to refresh its outline.");
      }
    } catch (requestError) {
      setSaveError(requestError instanceof ApiError ? requestError.message : "Could not save this file. Try again.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <section className={autoEdit ? "vscode-inspector" : "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card"} aria-label={`Inspect ${file.name}`}>
      <header className={autoEdit ? "vscode-editor-header" : "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"}>
        {autoEdit ? <div className="vscode-tabs" role="tablist" aria-label="Open files">
          {(openFiles?.length ? openFiles : [file]).map((openFile) => {
            const selected = openFile.file_id === file.file_id;
            return <div key={openFile.file_id} className={`vscode-tab ${selected ? "is-active" : ""}`}>
              <button type="button" role="tab" aria-selected={selected} aria-controls="code-editor-content" title={openFile.path} onClick={() => onSelectOpenFile?.(openFile)}>
                <FileCode2 size={14} className={`file-color-${openFile.language ?? "other"}`} />
                <span>{openFile.name}</span>
              </button>
              <button type="button" className="vscode-tab-close" disabled={selected && isSaving} onClick={() => selected ? closeFile() : onCloseOpenFile?.(openFile)} title={selected ? "Close file preview" : `Close ${openFile.name}`} aria-label={`Close ${openFile.name}`}>
                {selected && isDirty ? <span className="vscode-dirty-dot" /> : <X size={13} />}
              </button>
            </div>;
          })}
        </div> : <div className="flex min-w-0 items-center gap-2.5">
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
        </div>}

        <div className={autoEdit ? "vscode-editor-actions" : "flex items-center gap-1.5"}>
          {isEditing ? <>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={isSaving || readOnly} onClick={discardEdits}>Discard</Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={!isDirty || isSaving || readOnly} onClick={() => void handleSave()} title="Save (Ctrl/Cmd+S)">
              {isSaving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </> : preview && !preview.is_binary && !error && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={!canEdit || readOnly} title={preview.editing_disabled_reason ?? undefined} onClick={() => { setDraft(baseline); setIsEditing(true); setSaveNotice(null); }}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {onAskAI && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onAskAI(file)}>
              <MessageSquareCode className="h-3.5 w-3.5 text-violet-400" />
              Ask AI
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-8" onClick={() => void handleCopyPath()} title="Copy relative path">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          {!autoEdit && <Button variant="ghost" size="icon" className="size-8" disabled={isSaving} onClick={closeFile} title="Close file preview">
            <X className="h-4 w-4" />
          </Button>}
        </div>
      </header>

      {autoEdit ? <nav className="vscode-breadcrumbs" aria-label="File breadcrumbs">
        {file.path.split("/").map((part, index, parts) => <span key={index}>
          {index > 0 && <ChevronRight size={12} />}
          {index === parts.length - 1 && <FileCode2 size={13} className={`file-color-${file.language ?? "other"}`} />}
          {part}
        </span>)}
        {isDirty && <span className="vscode-unsaved-tag" role="status">Unsaved changes</span>}
      </nav> : <div className="flex items-center gap-4 border-b border-border bg-secondary/30 px-4 py-2 text-[11px] text-muted-foreground">
        <span>{formatBytes(preview?.size_bytes ?? file.size_bytes)}</span>
        <span>{isEditing ? `${draftLines.length.toLocaleString()} lines` : lines.length ? `${lines.length.toLocaleString()} lines` : "No source loaded"}</span>
        <span>{symbols.length} {symbols.length === 1 ? "symbol" : "symbols"}</span>
        {preview?.truncated && <span className="text-amber-300">Preview limited to 500 KB</span>}
        {isDirty && <span className="text-amber-300" role="status">Unsaved changes</span>}
      </div>}

      {saveError && <p className="border-b border-border px-4 py-2 text-xs text-destructive" role="alert">{saveError}</p>}
      {saveNotice && <p className="border-b border-border px-4 py-2 text-xs text-emerald-500" role="status">{saveNotice}</p>}
      {preview?.editing_disabled_reason && !preview.is_binary && <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">{preview.editing_disabled_reason}</p>}

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
        <div id={autoEdit ? "code-editor-content" : undefined} role={autoEdit ? "tabpanel" : undefined} aria-label={autoEdit ? file.name : undefined} className={`file-inspector-grid min-h-0 flex-1 ${autoEdit ? "vscode-editor-grid" : ""}`} style={autoEdit && !outlineVisible ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
          {isEditing && autoEdit ? <Suspense fallback={<div className="flex items-center justify-center text-xs text-muted-foreground">Loading editor…</div>}><CodeEditorSurface
            ref={codeEditorRef}
            value={draft}
            label={`Edit ${file.name}`}
            language={file.language}
            tabSize={settings.tabSize}
            lineNumbers={settings.lineNumbers}
            wordWrap={settings.wordWrap}
            readOnly={isSaving || readOnly}
            onChange={(value) => { setDraft(value); setSaveNotice(null); }}
            onSave={() => void handleSave()}
            onCursorChange={setCursor}
          /></Suspense> : isEditing ? (
            <div className="flex min-h-0 overflow-hidden bg-background font-mono text-[12px] leading-5">
              {settings.lineNumbers && !settings.wordWrap && <div ref={gutterRef} aria-hidden="true" className="w-14 shrink-0 overflow-hidden py-2 pr-3 text-right text-muted-foreground select-none">
                {draftLines.map((_, index) => <div key={index}>{index + 1}</div>)}
              </div>}
              <textarea
                ref={editorRef}
                autoFocus
                aria-label={`Edit ${file.name}`}
                className="h-full min-h-0 min-w-0 flex-1 resize-none border-0 bg-transparent px-3 py-2 font-mono text-[12px] leading-5 text-foreground outline-none"
                style={{ tabSize: settings.tabSize }}
                wrap={settings.wordWrap ? "soft" : "off"}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                value={draft}
                readOnly={isSaving || readOnly}
                onChange={(event) => { setDraft(event.target.value); setSaveNotice(null); }}
                onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop; }}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                    event.preventDefault();
                    void handleSave();
                  } else if (event.key === "Tab" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !isSaving && !readOnly) {
                    event.preventDefault();
                    const { selectionStart, selectionEnd } = event.currentTarget;
                    const spaces = " ".repeat(settings.tabSize);
                    setDraft(draft.slice(0, selectionStart) + spaces + draft.slice(selectionEnd));
                    setSaveNotice(null);
                    requestAnimationFrame(() => editorRef.current?.setSelectionRange(selectionStart + spaces.length, selectionStart + spaces.length));
                  }
                }}
              />
            </div>
          ) : <div ref={sourceRef} style={{ tabSize: settings.tabSize }} className="min-h-0 overflow-auto bg-background py-2 font-mono text-[12px] leading-5" role="region" aria-label="Source code">
            {lines.map((line, index) => {
              const lineNumber = index + 1;
              return (
                <div
                  key={lineNumber}
                  data-line={lineNumber}
                  className={`flex ${settings.wordWrap ? "min-w-0" : "min-w-max"} border-l-2 ${activeLine === lineNumber ? "border-blue-400 bg-blue-500/10" : "border-transparent"}`}
                >
                  {settings.lineNumbers && <button
                    type="button"
                    className="w-14 shrink-0 select-none pr-3 text-right text-zinc-600 hover:text-zinc-300"
                    onClick={() => setActiveLine(lineNumber)}
                    aria-label={`Line ${lineNumber}`}
                  >
                    {lineNumber}
                  </button>}
                  <code style={{ whiteSpace: settings.wordWrap ? "pre-wrap" : "pre", overflowWrap: settings.wordWrap ? "anywhere" : undefined }} className={`min-w-0 pr-6 text-foreground/85 ${settings.lineNumbers ? "" : "pl-3"}`}>{line || " "}</code>
                </div>
              );
            })}
            {lines.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">This file is empty.</p>}
          </div>}

          {(!autoEdit || outlineVisible) && <aside className="flex min-h-0 flex-col border-l border-border bg-card" aria-label="Symbol outline">
            <div className="border-b border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Braces className="h-3.5 w-3.5 text-violet-400" /> {isDirty ? "Outline (last saved)" : "Outline"}
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
          </aside>}
        </div>
      )}
      {autoEdit && <footer className="vscode-file-status" aria-label="Editor status">
        <span>{isSaving ? "Saving…" : isDirty ? "Modified" : canEdit ? "Ready" : "Read-only"}</span>
        <div>
          <span>Ln {cursor.line}, Col {cursor.column}</span>
          <span>Spaces: {settings.tabSize}</span>
          <span>UTF-8</span>
          <span>{preview?.content?.includes("\r\n") ? "CRLF" : "LF"}</span>
          <span className="capitalize">{file.language === "other" ? "Plain Text" : file.language ?? "Plain Text"}</span>
          <span>{formatBytes(preview?.size_bytes ?? file.size_bytes)}</span>
        </div>
      </footer>}
    </section>
  );
}

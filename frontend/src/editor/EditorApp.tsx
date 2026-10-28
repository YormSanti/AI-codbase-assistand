import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Blocks, Code2, Files, GitBranch, PanelLeft, PanelRight, SaveAll, Search, Settings, Sparkles, SquareTerminal, TextSearch, X } from "lucide-react";
import { Dialog, Menubar } from "radix-ui";
import type { RepositoryInfo } from "../types/domain";
import { PageFallback } from "../components/PageFallback";
import { ThemeToggle } from "../components/ThemeToggle";
import { WindowControls } from "../components/WindowControls";
import type { EditorCommand, EditorToolView } from "./editorCommands";
import "./EditorApp.css";
import { EditorShellContext, type EditorShell } from "./editorShell";

// Tool views load on first use so opening the editor does not fetch the
// terminal emulator, AI console, marketplace, or settings up front.
const AIAgentPage = lazy(() => import("../components/AIAgentPage").then(m => ({ default: m.AIAgentPage })));
const TerminalPage = lazy(() => import("../components/TerminalPage").then(m => ({ default: m.TerminalPage })));
const EditorExtensionsPage = lazy(() => import("./EditorExtensionsPage").then(m => ({ default: m.EditorExtensionsPage })));
const EditorGitPage = lazy(() => import("./EditorGitPage").then(m => ({ default: m.EditorGitPage })));
const EditorSettingsPage = lazy(() => import("./EditorSettingsPage").then(m => ({ default: m.EditorSettingsPage })));
const EditorSearchPage = lazy(() => import("./EditorSearchPage").then(m => ({ default: m.EditorSearchPage })));

interface Props {
  active: boolean;
  repository: RepositoryInfo | null;
  isLoading: boolean;
  onNavigate: (view: string) => void;
  /** The view "Back to IFROG" returns to: the page the editor was opened from. */
  returnView?: string;
  onCommand?: (command: EditorCommand) => void;
  /** Open a file at a line, used by project-wide search results. */
  onRevealLine?: (path: string, line: number) => void;
  /** Returns a reason to refuse an action that rewrites files (branch switch, pull), such as unsaved drafts. */
  workingTreeGuard?: (action: string) => string | null;
  /** Called after Source Control rewrote the working tree (branch switch, pull). */
  onWorkingTreeChanged?: () => void;
  /** A tool view to open once the shell is active (command palette, Git page). */
  requestedView?: EditorToolView | null;
  onRequestedViewHandled?: () => void;
  hasSelectedFile?: boolean;
  aiPrompt?: string | null;
  onAiPromptConsumed?: () => void;
  children: ReactNode | ((visible: boolean) => ReactNode);
}

// Keep the shared file workspace at the same position in the tree so entering
// the editor from File Explorer does not remount the current unsaved draft.
export function EditorApp({ active, repository, isLoading, onNavigate, returnView = "dashboard", onCommand, onRevealLine, requestedView, onRequestedViewHandled, workingTreeGuard, onWorkingTreeChanged, hasSelectedFile = false, aiPrompt, onAiPromptConsumed, children }: Props) {
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalRoot, setTerminalRoot] = useState<string | null>(null);
  const [terminalHeight, setTerminalHeight] = useState(260);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ y: number; height: number } | null>(null);
  const menuCommandPending = useRef(false);
  const [gitRoot, setGitRoot] = useState<string | null>(null);
  const [showGit, setShowGit] = useState(false);
  const gitVisible = active && showGit && gitRoot === (repository?.root_path ?? "");
  const [aiRoot, setAiRoot] = useState<string | null>(null);
  const [historyRequest, setHistoryRequest] = useState<{ path: string; id: number } | null>(null);
  // Prompts drafted inside the editor (for example "Review with AI" on a diff).
  const [localAiPrompt, setLocalAiPrompt] = useState<string | null>(null);
  const [showAi, setShowAi] = useState(false);
  const aiVisible = active && showAi && aiRoot === (repository?.root_path ?? "");
  const [showExtensions, setShowExtensions] = useState(false);
  const extensionsVisible = active && showExtensions;
  const [showSettings, setShowSettings] = useState(false);
  const settingsVisible = active && showSettings;
  const [showSearch, setShowSearch] = useState(false);
  const searchVisible = active && showSearch;
  const [searchOpened, setSearchOpened] = useState(false);
  useEffect(() => { if (showSearch) setSearchOpened(true); }, [showSearch]);
  // Mount these views on first open and keep them mounted afterwards so their
  // state survives switching back to code.
  const [extensionsOpened, setExtensionsOpened] = useState(false);
  const [settingsOpened, setSettingsOpened] = useState(false);
  useEffect(() => { if (showExtensions) setExtensionsOpened(true); }, [showExtensions]);
  useEffect(() => { if (showSettings) setSettingsOpened(true); }, [showSettings]);
  const [explorerVisible, setExplorerVisible] = useState(true);
  const toolVisible = gitVisible || aiVisible || extensionsVisible || settingsVisible || searchVisible;
  const canOpenTerminal = Boolean(repository) && !isLoading;
  const terminalVisible = active && showTerminal && canOpenTerminal;
  const fileActionsDisabled = !hasSelectedFile || isLoading;

  const toggleTerminal = useCallback(() => {
    if (!canOpenTerminal) return;
    setShowTerminal(value => !value);
  }, [canOpenTerminal]);

  useEffect(() => {
    if (terminalVisible && repository) setTerminalRoot(repository.root_path);
  }, [terminalVisible, repository]);

  useEffect(() => {
    if (aiPrompt && repository) {
      setShowGit(false);
      setShowExtensions(false);
      setShowSettings(false);
      setShowSearch(false);
      setAiRoot(repository.root_path);
      setShowAi(true);
    }
  }, [aiPrompt, repository]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === "Backquote") {
        event.preventDefault();
        toggleTerminal();
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "x") {
        event.preventDefault();
        if (extensionsVisible) {
          setShowExtensions(false);
        } else {
          setShowGit(false);
          setShowAi(false);
          setShowSettings(false);
          setShowExtensions(true);
        }
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (searchVisible) {
          setShowSearch(false);
        } else {
          setShowGit(false);
          setShowAi(false);
          setShowExtensions(false);
          setShowSettings(false);
          setShowSearch(true);
        }
      } else if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        if (settingsVisible) {
          setShowSettings(false);
        } else {
          setShowGit(false);
          setShowAi(false);
          setShowExtensions(false);
          setShowSettings(true);
        }
      } else if ((toolVisible) && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setShowGit(false);
        setShowAi(false);
        setShowExtensions(false);
        setShowSettings(false);
        requestAnimationFrame(() => onCommand?.("openFile"));
      } else if ((toolVisible) && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onCommand?.(event.shiftKey ? "saveAll" : "save");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, toggleTerminal, toolVisible, extensionsVisible, settingsVisible, searchVisible, onCommand]);

  const resizeTerminal = (height: number) => {
    const available = contentRef.current?.clientHeight || 600;
    setTerminalHeight(Math.max(160, Math.min(Math.max(160, available - 180), height)));
  };
  const openGit = () => { setShowAi(false); setShowExtensions(false); setShowSettings(false); setShowSearch(false); setGitRoot(repository?.root_path ?? ""); setShowGit(true); };
  const openAi = () => { setShowGit(false); setShowExtensions(false); setShowSettings(false); setShowSearch(false); setAiRoot(repository?.root_path ?? ""); setShowAi(true); };
  const openExtensions = () => { setShowGit(false); setShowAi(false); setShowSettings(false); setShowSearch(false); setShowExtensions(true); };
  const openSettings = () => { setShowGit(false); setShowAi(false); setShowExtensions(false); setShowSearch(false); setShowSettings(true); };
  const openSearch = () => { setShowGit(false); setShowAi(false); setShowExtensions(false); setShowSettings(false); setShowSearch(true); };
  useEffect(() => {
    if (!active || !requestedView) return;
    if (requestedView === "search" && repository) openSearch();
    else if (requestedView === "git") openGit();
    else if (requestedView === "ai") openAi();
    else if (requestedView === "symbols" && repository) onCommand?.("openSymbol");
    onRequestedViewHandled?.();
    // openX are stable closures over state setters; re-running on their identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, requestedView, repository?.root_path]);
  const shell: EditorShell | null = active && repository ? {
    showFileHistory: path => { setHistoryRequest({ path, id: Date.now() }); openGit(); },
  } : null;
  const returnToCode = () => { setShowGit(false); setShowAi(false); setShowExtensions(false); setShowSettings(false); setShowSearch(false); };
  const toggleExplorerPanel = () => {
    if (toolVisible) {
      returnToCode();
      if (!explorerVisible) {
        setExplorerVisible(true);
        onCommand?.("showExplorer");
      }
    } else {
      setExplorerVisible(value => !value);
      onCommand?.("toggleExplorer");
    }
  };
  const runCommand = (command: EditorCommand) => {
    if (command === "toggleExplorer") {
      setExplorerVisible(value => !value);
    } else if (command === "showExplorer") {
      setExplorerVisible(true);
    } else if (command === "hideExplorer") {
      setExplorerVisible(false);
    }
    if ((toolVisible) && command !== "save" && command !== "saveAll") {
      returnToCode();
      requestAnimationFrame(() => onCommand?.(command));
    } else onCommand?.(command);
  };

  const commandItem = (label: string, command: EditorCommand, shortcut?: string, needsFile = false) => (
    <Menubar.Item key={command} className="ifrog-editor-menu-item" disabled={isLoading || (needsFile && fileActionsDisabled)} onSelect={() => { menuCommandPending.current = true; requestAnimationFrame(() => runCommand(command)); }}>
      {label}{shortcut && <kbd>{shortcut}</kbd>}
    </Menubar.Item>
  );
  const menus = [
    { label: "File", items: <>
      {commandItem("Open Folder…", "openFolder")}{commandItem("Go to File…", "openFile", "Ctrl/Cmd P")}
      <Menubar.Separator className="ifrog-editor-menu-separator" />
      {commandItem("Save", "save", "Ctrl/Cmd S", true)}{commandItem("Save All", "saveAll", "Ctrl/Cmd Shift S")}{commandItem("Close Editor", "closeFile", "Ctrl/Cmd W", true)}
      <Menubar.Separator className="ifrog-editor-menu-separator" />
      <Menubar.Item className="ifrog-editor-menu-item" onSelect={() => onNavigate("explorer")}>File Explorer</Menubar.Item>
      <Menubar.Item className="ifrog-editor-menu-item" onSelect={() => onNavigate(returnView)}>Back to IFROG</Menubar.Item>
    </> },
    { label: "Edit", items: <>
      {commandItem("Undo", "undo", "Ctrl/Cmd Z", true)}{commandItem("Redo", "redo", "Ctrl/Cmd Shift Z", true)}
      <Menubar.Separator className="ifrog-editor-menu-separator" />
      {commandItem("Find / Replace…", "find", "Ctrl/Cmd F", true)}
      <Menubar.Item className="ifrog-editor-menu-item" disabled={!repository} onSelect={openSearch}>Search in Files…<kbd>Ctrl/Cmd Shift F</kbd></Menubar.Item>
    </> },
    { label: "Selection", items: commandItem("Select All", "selectAll", "Ctrl/Cmd A", true) },
    { label: "View", items: <>
      <Menubar.Item className="ifrog-editor-menu-item" onSelect={openGit}>Git Repository</Menubar.Item>
      <Menubar.Item className="ifrog-editor-menu-item" onSelect={openAi}>AI Assistant</Menubar.Item>
      <Menubar.Item className="ifrog-editor-menu-item" onSelect={openExtensions}>Extensions<kbd>Ctrl/Cmd Shift X</kbd></Menubar.Item>
      {commandItem("Toggle Explorer", "toggleExplorer")}{commandItem("Toggle Symbol Outline", "toggleOutline")}{commandItem("Toggle Minimap", "toggleMinimap")}{commandItem("Toggle Word Wrap", "toggleWordWrap")}{commandItem("Refresh Local Files", "refreshFiles")}
      <Menubar.Separator className="ifrog-editor-menu-separator" />
      <Menubar.Item className="ifrog-editor-menu-item" onSelect={openSettings}>Editor Settings<kbd>Ctrl/Cmd ,</kbd></Menubar.Item>
    </> },
    { label: "Go", items: <>
      {commandItem("Go to File…", "openFile", "Ctrl/Cmd P")}{commandItem("Go to Symbol in Workspace…", "openSymbol", "Ctrl/Cmd T")}{commandItem("Go to Line…", "goToLine", "Ctrl/Cmd G", true)}
      <Menubar.Separator className="ifrog-editor-menu-separator" />
      {commandItem("Previous Editor", "previousFile", "Ctrl/Cmd Alt ←", true)}{commandItem("Next Editor", "nextFile", "Ctrl/Cmd Alt →", true)}
    </> },
    { label: "Terminal", items: <Menubar.Item className="ifrog-editor-menu-item" disabled={!canOpenTerminal} onSelect={toggleTerminal}>{terminalVisible ? "Hide Terminal" : "Show Terminal"}<kbd>Ctrl/Cmd `</kbd></Menubar.Item> },
    { label: "Help", items: <Menubar.Item className="ifrog-editor-menu-item" onSelect={() => setShowShortcuts(true)}>Keyboard Shortcuts</Menubar.Item> },
  ];

  return (
    <div className={active ? "ifrog-editor-app" : "ifrog-file-workspace"} role={active ? "region" : undefined} aria-label={active ? "IFROG Editor" : undefined}>
      {active && <header className="ifrog-editor-topbar" data-tauri-drag-region>
        <div className="ifrog-editor-brand" title="IFROG Editor"><Code2 size={20} /></div>
        <Menubar.Root className="ifrog-editor-menubar" aria-label="Editor menu">
          {menus.map(menu => <Menubar.Menu key={menu.label}>
            <Menubar.Trigger className="ifrog-editor-menu-trigger">{menu.label}</Menubar.Trigger>
            <Menubar.Portal><Menubar.Content className="ifrog-editor-menu" align="start" sideOffset={5} onCloseAutoFocus={event => { if (menuCommandPending.current) { event.preventDefault(); menuCommandPending.current = false; } }}>{menu.items}</Menubar.Content></Menubar.Portal>
          </Menubar.Menu>)}
        </Menubar.Root>
        <button type="button" className="ifrog-editor-command-center" aria-label="Search project files" title="Go to file (Ctrl/Cmd+P)" disabled={!repository || isLoading} onClick={() => runCommand("openFile")}><Search size={14} /><span>{repository?.name ?? "IFROG Editor"}</span><kbd>Ctrl/Cmd P</kbd></button>
        <div className="ifrog-editor-topbar-actions" data-tauri-drag-region>
          <button type="button" className="ifrog-editor-back" aria-label="Back to IFROG" title="Back to IFROG" onClick={() => onNavigate(returnView)}><ArrowLeft size={16} /></button>
          <button type="button" aria-label="Save all files" title="Save all files (Ctrl/Cmd+Shift+S)" disabled={!repository || isLoading} onClick={() => onCommand?.("saveAll")}><SaveAll size={16} /></button>
          <button type="button" aria-label="Toggle file explorer" aria-pressed={explorerVisible} title="Toggle Explorer" onClick={toggleExplorerPanel}><PanelLeft size={16} /></button>
          <button type="button" aria-label="Toggle symbol outline" title="Toggle Symbol Outline" onClick={() => runCommand("toggleOutline")}><PanelRight size={16} /></button>
          <button type="button" className="ifrog-editor-terminal-toggle" aria-label="Toggle integrated terminal" aria-pressed={terminalVisible} aria-controls="ifrog-editor-terminal" disabled={!canOpenTerminal} onClick={toggleTerminal} title="Toggle terminal (Ctrl/Cmd+`)">
            <SquareTerminal size={16} />
          </button>
          <ThemeToggle />
          <WindowControls />
        </div>
      </header>}

      <div className={active ? "ifrog-editor-body" : "ifrog-file-workspace-body"}>
        {active && <nav className="ifrog-editor-rail" aria-label="Editor tools">
          <div className="ifrog-editor-rail-top">
            <button type="button" className={explorerVisible && !toolVisible ? "ifrog-editor-rail-active" : undefined} aria-label="Explorer" aria-pressed={explorerVisible} title="Toggle Explorer" onClick={toggleExplorerPanel}><Files size={23} /></button>
            <button type="button" aria-label="Go to file" title="Go to file (Ctrl/Cmd+P)" onClick={() => runCommand("openFile")}><Search size={23} /></button>
            <button type="button" className={searchVisible ? "ifrog-editor-rail-active" : undefined} aria-label="Search in files" aria-pressed={searchVisible} title="Search in files (Ctrl/Cmd+Shift+F)" disabled={!repository} onClick={searchVisible ? returnToCode : openSearch}><TextSearch size={21} /></button>
            <button type="button" className={gitVisible ? "ifrog-editor-rail-active" : undefined} aria-label="Git Repository" aria-pressed={gitVisible} title="Git Repository" onClick={openGit}><GitBranch size={20} /></button>
            <button type="button" className={aiVisible ? "ifrog-editor-rail-active" : undefined} aria-label="AI Assistant" aria-pressed={aiVisible} title="AI Assistant" onClick={aiVisible ? returnToCode : openAi}><Sparkles size={20} /></button>
            <button type="button" className={extensionsVisible ? "ifrog-editor-rail-active" : undefined} aria-label="Extensions" aria-pressed={extensionsVisible} title="Extensions (Ctrl/Cmd+Shift+X)" onClick={extensionsVisible ? returnToCode : openExtensions}><Blocks size={20} /></button>
            <button type="button" aria-label="Editor terminal" title="Toggle integrated terminal" aria-pressed={terminalVisible} disabled={!canOpenTerminal} onClick={toggleTerminal}><SquareTerminal size={20} /></button>
          </div>
          <button type="button" className={settingsVisible ? "ifrog-editor-rail-active" : undefined} aria-label="Editor settings" aria-pressed={settingsVisible} title="Editor settings (Ctrl/Cmd+,)" onClick={settingsVisible ? returnToCode : openSettings}><Settings size={20} /></button>
        </nav>}

        <div ref={contentRef} className={active ? "ifrog-editor-content" : "ifrog-file-workspace-content"}>
          <div className={active ? "ifrog-editor-workspace" : "ifrog-file-workspace-page"} hidden={toolVisible}>
            <EditorShellContext.Provider value={shell}>
              {typeof children === "function" ? children(!toolVisible) : children}
            </EditorShellContext.Provider>
          </div>

          {gitRoot === (repository?.root_path ?? "") && <div className="ifrog-editor-git-view" hidden={!gitVisible}><Suspense fallback={<PageFallback />}><EditorGitPage key={repository?.id ?? "none"} repository={repository} active={gitVisible} onReturn={returnToCode} onOpenFolder={() => runCommand("openFolder")} onAskAI={prompt => { setLocalAiPrompt(prompt); openAi(); }} workingTreeGuard={workingTreeGuard} onWorkingTreeChanged={() => { onCommand?.("refreshFiles"); onWorkingTreeChanged?.(); }} historyRequest={historyRequest} onHistoryHandled={() => setHistoryRequest(null)} /></Suspense></div>}

          {aiRoot === (repository?.root_path ?? "") && <div className="ifrog-editor-ai-view" hidden={!aiVisible}>
            <header className="editor-git-header">
              <div className="editor-git-tab"><Sparkles size={15} /><span>AI Assistant</span></div>
              <div className="editor-git-header-actions">
                <button type="button" onClick={returnToCode} aria-label="Back to code"><ArrowLeft size={14} /><span>Back to code</span></button>
              </div>
            </header>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <Suspense fallback={<PageFallback />}>
                <AIAgentPage
                  key={repository?.id ?? "none"}
                  repository={repository}
                  threadId="editor"
                  initialPrompt={aiPrompt ?? localAiPrompt}
                  onInitialPromptConsumed={() => { setLocalAiPrompt(null); onAiPromptConsumed?.(); }}
                />
              </Suspense>
            </div>
          </div>}

          {extensionsOpened && <div className="ifrog-editor-extensions-view" hidden={!extensionsVisible}>
            <Suspense fallback={<PageFallback />}>
              <EditorExtensionsPage active={extensionsVisible} onReturn={returnToCode} />
            </Suspense>
          </div>}

          {searchOpened && <div className="ifrog-editor-search-view" hidden={!searchVisible}>
            <Suspense fallback={<PageFallback />}>
              <EditorSearchPage active={searchVisible} repository={repository} onReturn={returnToCode} onOpenMatch={(path, line) => { returnToCode(); requestAnimationFrame(() => onRevealLine?.(path, line)); }} />
            </Suspense>
          </div>}

          {settingsOpened && <div className="ifrog-editor-settings-view" hidden={!settingsVisible}>
            <Suspense fallback={<PageFallback />}>
              <EditorSettingsPage
                active={settingsVisible}
                onReturn={returnToCode}
                onNavigateToGlobalSettings={() => onNavigate("settings")}
              />
            </Suspense>
          </div>}

          {repository && terminalRoot === repository.root_path && <section id="ifrog-editor-terminal" className="ifrog-editor-terminal" aria-label="Integrated terminal" hidden={!terminalVisible} style={{ height: terminalHeight }}>
            <div className="ifrog-editor-terminal-resizer" role="separator" aria-label="Resize integrated terminal" aria-orientation="horizontal" aria-valuenow={terminalHeight} aria-valuemin={160} tabIndex={0}
              onPointerDown={event => { dragStart.current = { y: event.clientY, height: terminalHeight }; event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerMove={event => { if (dragStart.current) resizeTerminal(dragStart.current.height + dragStart.current.y - event.clientY); }}
              onPointerUp={event => { dragStart.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
              onPointerCancel={() => { dragStart.current = null; }}
              onKeyDown={event => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); resizeTerminal(terminalHeight + (event.key === "ArrowUp" ? 20 : -20)); } }}
            />
            <header className="ifrog-editor-panel-header"><span>TERMINAL</span><span title={repository.root_path}>{repository.root_path}</span><button type="button" aria-label="Hide integrated terminal" title="Hide terminal" onClick={() => setShowTerminal(false)}><X size={15} /></button></header>
            <div className="ifrog-editor-terminal-session"><Suspense fallback={<PageFallback />}><TerminalPage key={repository.root_path} repository={repository} isActive={terminalVisible} /></Suspense></div>
          </section>}
        </div>
      </div>
      <Dialog.Root open={active && showShortcuts} onOpenChange={setShowShortcuts}>
        <Dialog.Portal>
          <Dialog.Overlay className="ifrog-editor-help-overlay" />
          <Dialog.Content className="ifrog-editor-help">
            <Dialog.Title>Keyboard Shortcuts</Dialog.Title>
            <Dialog.Description>Use Ctrl on Linux and Windows, or Cmd on macOS.</Dialog.Description>
            <dl>{[["Go to File", "Ctrl/Cmd P"], ["Go to Symbol", "Ctrl/Cmd T"], ["Save", "Ctrl/Cmd S"], ["Save All", "Ctrl/Cmd Shift S"], ["Close Editor", "Ctrl/Cmd W"], ["Find / Replace", "Ctrl/Cmd F"], ["Search in Files", "Ctrl/Cmd Shift F"], ["Go to Line", "Ctrl/Cmd G"], ["Undo", "Ctrl/Cmd Z"], ["Redo", "Ctrl/Cmd Shift Z"], ["Extensions", "Ctrl/Cmd Shift X"], ["Editor Settings", "Ctrl/Cmd ,"], ["Toggle Terminal", "Ctrl/Cmd `"]].map(([label, shortcut]) => <div key={label}><dt>{label}</dt><dd><kbd>{shortcut}</kbd></dd></div>)}</dl>
            <Dialog.Close className="ifrog-editor-help-close" aria-label="Close keyboard shortcuts"><X size={17} /></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

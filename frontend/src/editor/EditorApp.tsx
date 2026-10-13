import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Code2, Files, GitBranch, PanelLeft, PanelRight, SaveAll, Search, Settings, Sparkles, SquareTerminal, X } from "lucide-react";
import { Dialog, Menubar } from "radix-ui";
import type { RepositoryInfo } from "../types/domain";
import { TerminalPage } from "../components/TerminalPage";
import { ThemeToggle } from "../components/ThemeToggle";
import type { EditorCommand } from "./editorCommands";
import { EditorGitPage } from "./EditorGitPage";
import "./EditorApp.css";

interface Props {
  active: boolean;
  repository: RepositoryInfo | null;
  isLoading: boolean;
  onNavigate: (view: string) => void;
  onCommand?: (command: EditorCommand) => void;
  hasSelectedFile?: boolean;
  children: ReactNode | ((visible: boolean) => ReactNode);
}

// Keep the shared file workspace at the same position in the tree so entering
// the editor from File Explorer does not remount the current unsaved draft.
export function EditorApp({ active, repository, isLoading, onNavigate, onCommand, hasSelectedFile = false, children }: Props) {
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
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === "Backquote") {
        event.preventDefault();
        toggleTerminal();
      } else if (gitVisible && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setShowGit(false);
        requestAnimationFrame(() => onCommand?.("openFile"));
      } else if (gitVisible && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onCommand?.(event.shiftKey ? "saveAll" : "save");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, toggleTerminal, gitVisible, onCommand]);

  const resizeTerminal = (height: number) => {
    const available = contentRef.current?.clientHeight || 600;
    setTerminalHeight(Math.max(160, Math.min(Math.max(160, available - 180), height)));
  };
  const openGit = () => { setGitRoot(repository?.root_path ?? ""); setShowGit(true); };
  const returnToCode = () => setShowGit(false);
  const runCommand = (command: EditorCommand) => {
    if (gitVisible && command !== "save" && command !== "saveAll") {
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
      <Menubar.Item className="ifrog-editor-menu-item" onSelect={() => onNavigate("dashboard")}>Back to IFROG</Menubar.Item>
    </> },
    { label: "Edit", items: <>
      {commandItem("Undo", "undo", "Ctrl/Cmd Z", true)}{commandItem("Redo", "redo", "Ctrl/Cmd Shift Z", true)}
      <Menubar.Separator className="ifrog-editor-menu-separator" />
      {commandItem("Find / Replace…", "find", "Ctrl/Cmd F", true)}
    </> },
    { label: "Selection", items: commandItem("Select All", "selectAll", "Ctrl/Cmd A", true) },
    { label: "View", items: <>
      <Menubar.Item className="ifrog-editor-menu-item" onSelect={openGit}>Git Repository</Menubar.Item>
      {commandItem("Toggle Explorer", "toggleExplorer")}{commandItem("Toggle Symbol Outline", "toggleOutline")}{commandItem("Toggle Minimap", "toggleMinimap")}{commandItem("Toggle Word Wrap", "toggleWordWrap")}{commandItem("Refresh Local Files", "refreshFiles")}
      <Menubar.Separator className="ifrog-editor-menu-separator" />
      <Menubar.Item className="ifrog-editor-menu-item" onSelect={() => onNavigate("settings")}>Editor Settings</Menubar.Item>
    </> },
    { label: "Go", items: <>
      {commandItem("Go to File…", "openFile", "Ctrl/Cmd P")}{commandItem("Go to Line…", "goToLine", "Ctrl/Cmd G", true)}
      <Menubar.Separator className="ifrog-editor-menu-separator" />
      {commandItem("Previous Editor", "previousFile", "Ctrl/Cmd Alt ←", true)}{commandItem("Next Editor", "nextFile", "Ctrl/Cmd Alt →", true)}
    </> },
    { label: "Terminal", items: <Menubar.Item className="ifrog-editor-menu-item" disabled={!canOpenTerminal} onSelect={toggleTerminal}>{terminalVisible ? "Hide Terminal" : "Show Terminal"}<kbd>Ctrl/Cmd `</kbd></Menubar.Item> },
    { label: "Help", items: <Menubar.Item className="ifrog-editor-menu-item" onSelect={() => setShowShortcuts(true)}>Keyboard Shortcuts</Menubar.Item> },
  ];

  return (
    <div className={active ? "ifrog-editor-app" : "ifrog-file-workspace"} role={active ? "region" : undefined} aria-label={active ? "IFROG Editor" : undefined}>
      {active && <header className="ifrog-editor-topbar">
        <div className="ifrog-editor-brand" title="IFROG Editor"><Code2 size={20} /></div>
        <Menubar.Root className="ifrog-editor-menubar" aria-label="Editor menu">
          {menus.map(menu => <Menubar.Menu key={menu.label}>
            <Menubar.Trigger className="ifrog-editor-menu-trigger">{menu.label}</Menubar.Trigger>
            <Menubar.Portal><Menubar.Content className="ifrog-editor-menu" align="start" sideOffset={5} onCloseAutoFocus={event => { if (menuCommandPending.current) { event.preventDefault(); menuCommandPending.current = false; } }}>{menu.items}</Menubar.Content></Menubar.Portal>
          </Menubar.Menu>)}
        </Menubar.Root>
        <button type="button" className="ifrog-editor-command-center" aria-label="Search project files" title="Go to file (Ctrl/Cmd+P)" disabled={!repository || isLoading} onClick={() => runCommand("openFile")}><Search size={14} /><span>{repository?.name ?? "IFROG Editor"}</span><kbd>Ctrl/Cmd P</kbd></button>
        <div className="ifrog-editor-topbar-actions">
          <button type="button" className="ifrog-editor-back" aria-label="Back to IFROG" title="Back to IFROG" onClick={() => onNavigate("dashboard")}><ArrowLeft size={16} /></button>
          <button type="button" aria-label="Save all files" title="Save all files (Ctrl/Cmd+Shift+S)" disabled={!repository || isLoading} onClick={() => onCommand?.("saveAll")}><SaveAll size={16} /></button>
          <button type="button" aria-label="Toggle file explorer" title="Toggle Explorer" onClick={() => gitVisible ? returnToCode() : onCommand?.("toggleExplorer")}><PanelLeft size={16} /></button>
          <button type="button" aria-label="Toggle symbol outline" title="Toggle Symbol Outline" onClick={() => runCommand("toggleOutline")}><PanelRight size={16} /></button>
          <button type="button" className="ifrog-editor-terminal-toggle" aria-label="Toggle integrated terminal" aria-pressed={terminalVisible} aria-controls="ifrog-editor-terminal" disabled={!canOpenTerminal} onClick={toggleTerminal} title="Toggle terminal (Ctrl/Cmd+`)">
            <SquareTerminal size={16} />
          </button>
          <ThemeToggle />
        </div>
      </header>}

      <div className={active ? "ifrog-editor-body" : "ifrog-file-workspace-body"}>
        {active && <nav className="ifrog-editor-rail" aria-label="Editor tools">
          <div className="ifrog-editor-rail-top">
            <button type="button" className={!gitVisible ? "ifrog-editor-rail-active" : undefined} aria-label="Explorer" title="Toggle Explorer" onClick={() => gitVisible ? returnToCode() : onCommand?.("toggleExplorer")}><Files size={23} /></button>
            <button type="button" aria-label="Search files" title="Go to file (Ctrl/Cmd+P)" onClick={() => runCommand("openFile")}><Search size={23} /></button>
            <button type="button" className={gitVisible ? "ifrog-editor-rail-active" : undefined} aria-label="Git Repository" aria-pressed={gitVisible} title="Git Repository" onClick={openGit}><GitBranch size={20} /></button>
            <button type="button" aria-label="AI Assistant" title="AI Assistant" onClick={() => onNavigate("ai")}><Sparkles size={20} /></button>
            <button type="button" aria-label="Editor terminal" title="Toggle integrated terminal" aria-pressed={terminalVisible} disabled={!canOpenTerminal} onClick={toggleTerminal}><SquareTerminal size={20} /></button>
          </div>
          <button type="button" aria-label="Editor settings" title="Editor settings" onClick={() => onNavigate("settings")}><Settings size={20} /></button>
        </nav>}

        <div ref={contentRef} className={active ? "ifrog-editor-content" : "ifrog-file-workspace-content"}>
          <div className={active ? "ifrog-editor-workspace" : "ifrog-file-workspace-page"} hidden={gitVisible}>
            {typeof children === "function" ? children(!gitVisible) : children}
          </div>

          {gitRoot === (repository?.root_path ?? "") && <div className="ifrog-editor-git-view" hidden={!gitVisible}><EditorGitPage key={repository?.id ?? "none"} repository={repository} active={gitVisible} onReturn={returnToCode} onOpenFolder={() => runCommand("openFolder")} /></div>}

          {repository && terminalRoot === repository.root_path && <section id="ifrog-editor-terminal" className="ifrog-editor-terminal" aria-label="Integrated terminal" hidden={!terminalVisible} style={{ height: terminalHeight }}>
            <div className="ifrog-editor-terminal-resizer" role="separator" aria-label="Resize integrated terminal" aria-orientation="horizontal" aria-valuenow={terminalHeight} aria-valuemin={160} tabIndex={0}
              onPointerDown={event => { dragStart.current = { y: event.clientY, height: terminalHeight }; event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerMove={event => { if (dragStart.current) resizeTerminal(dragStart.current.height + dragStart.current.y - event.clientY); }}
              onPointerUp={event => { dragStart.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
              onPointerCancel={() => { dragStart.current = null; }}
              onKeyDown={event => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); resizeTerminal(terminalHeight + (event.key === "ArrowUp" ? 20 : -20)); } }}
            />
            <header className="ifrog-editor-panel-header"><span>TERMINAL</span><span title={repository.root_path}>{repository.root_path}</span><button type="button" aria-label="Hide integrated terminal" title="Hide terminal" onClick={() => setShowTerminal(false)}><X size={15} /></button></header>
            <div className="ifrog-editor-terminal-session"><TerminalPage key={repository.root_path} repository={repository} isActive={terminalVisible} /></div>
          </section>}
        </div>
      </div>
      <Dialog.Root open={active && showShortcuts} onOpenChange={setShowShortcuts}>
        <Dialog.Portal>
          <Dialog.Overlay className="ifrog-editor-help-overlay" />
          <Dialog.Content className="ifrog-editor-help">
            <Dialog.Title>Keyboard Shortcuts</Dialog.Title>
            <Dialog.Description>Use Ctrl on Linux and Windows, or Cmd on macOS.</Dialog.Description>
            <dl>{[["Go to File", "Ctrl/Cmd P"], ["Save", "Ctrl/Cmd S"], ["Save All", "Ctrl/Cmd Shift S"], ["Close Editor", "Ctrl/Cmd W"], ["Find / Replace", "Ctrl/Cmd F"], ["Go to Line", "Ctrl/Cmd G"], ["Undo", "Ctrl/Cmd Z"], ["Redo", "Ctrl/Cmd Shift Z"], ["Toggle Terminal", "Ctrl/Cmd `"]].map(([label, shortcut]) => <div key={label}><dt>{label}</dt><dd><kbd>{shortcut}</kbd></dd></div>)}</dl>
            <Dialog.Close className="ifrog-editor-help-close" aria-label="Close keyboard shortcuts"><X size={17} /></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

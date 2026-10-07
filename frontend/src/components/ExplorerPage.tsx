import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, FileCode2, Files, FolderOpen, GitBranch, PanelLeft, PanelRight, RefreshCw, Search, WrapText, X } from 'lucide-react';
import type { FilePreview, RepositoryInfo, TreeNode } from '../types/domain';
import { RepositoryPicker } from './RepositoryPicker';
import { RepositorySummary } from './RepositorySummary';
import { RepositoryTree } from './RepositoryTree';
import { FileInspector } from './FileInspector';
import { useAppSettings } from '../hooks/useAppSettings';
import { Input } from './ui/input';
import { Dialog as DialogPrimitive } from 'radix-ui';
import './CodeEditor.css';
import { editorApi } from '../api/editorApi';

interface Props {
  mode?: 'explorer' | 'editor';
  repository: RepositoryInfo | null;
  tree: TreeNode | null;
  selectedFile: TreeNode | null;
  isLoading: boolean;
  onOpen: (path: string) => Promise<void> | void;
  onSelectFile: (node: TreeNode) => void;
  onCloseFile: () => void;
  onAskAI: (file: TreeNode) => void;
  onEditorStateChange?: (state: { dirty: boolean; saving: boolean }) => void;
  onFileSaved?: (preview: FilePreview) => void;
}

function collectFiles(node: TreeNode | null): TreeNode[] {
  if (!node) return [];
  return node.is_directory ? node.children.flatMap(collectFiles) : [node];
}

export function ExplorerPage({ mode = 'explorer', repository, tree: indexedTree, selectedFile, isLoading, onOpen, onSelectFile, onCloseFile, onAskAI, onEditorStateChange, onFileSaved }: Props) {
  const isEditor = mode === 'editor';
  const [localTree, setLocalTree] = useState<{ repository: RepositoryInfo; tree: TreeNode } | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const tree = isEditor && localTree?.repository === repository ? localTree.tree : indexedTree;
  const { settings, updateSettings } = useAppSettings();
  const [openFiles, setOpenFiles] = useState<TreeNode[]>([]);
  const [showExplorer, setShowExplorer] = useState(true);
  const [showOutline, setShowOutline] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showQuickOpen, setShowQuickOpen] = useState(false);
  const [fileQuery, setFileQuery] = useState('');
  const [quickIndex, setQuickIndex] = useState(0);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; width: number } | null>(null);
  const files = useMemo(() => collectFiles(tree), [tree]);
  const matches = useMemo(() => files.filter(file => file.path.toLowerCase().includes(fileQuery.toLowerCase())).slice(0, 30), [files, fileQuery]);

  useEffect(() => {
    if (!isEditor || !repository) {
      setFilesLoading(false);
      setFilesError(null);
      return;
    }
    let active = true;
    setFilesLoading(true);
    setFilesError(null);
    editorApi.getTree(repository.id)
      .then(tree => { if (active) setLocalTree({ repository, tree }); })
      .catch(error => { if (active) setFilesError(error instanceof Error ? error.message : 'Could not load local files.'); })
      .finally(() => { if (active) setFilesLoading(false); });
    return () => { active = false; };
  }, [isEditor, repository, refreshVersion]);

  const fileSaved = (preview: FilePreview) => {
    const update = (node: TreeNode): TreeNode => node.path === preview.path && !node.is_directory
      ? { ...node, size_bytes: preview.size_bytes ?? node.size_bytes }
      : { ...node, children: node.children.map(update) };
    setLocalTree(current => current ? { ...current, tree: update(current.tree) } : current);
    onFileSaved?.(preview);
  };

  useEffect(() => { setOpenFiles([]); }, [repository]);
  useEffect(() => {
    if (!selectedFile) return;
    setOpenFiles(current => current.some(file => file.file_id === selectedFile.file_id)
      ? current.map(file => file.file_id === selectedFile.file_id ? selectedFile : file)
      : [...current, selectedFile]);
  }, [selectedFile]);

  useEffect(() => {
    if (!isEditor) return;
    const quickOpen = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        if (tree) { setFileQuery(''); setQuickIndex(0); setShowQuickOpen(true); }
      }
      if (event.key === 'Escape') { setShowQuickOpen(false); setShowFolderPicker(false); }
    };
    window.addEventListener('keydown', quickOpen);
    return () => window.removeEventListener('keydown', quickOpen);
  }, [isEditor, tree]);

  useEffect(() => { if (showQuickOpen) quickInputRef.current?.focus(); }, [showQuickOpen]);

  const closeSelectedFile = () => {
    setOpenFiles(current => current.filter(file => file.file_id !== selectedFile?.file_id));
    onCloseFile();
  };
  const openFromSearch = (file: TreeNode) => { onSelectFile(file); setShowQuickOpen(false); };
  const cardStyle: CSSProperties = { borderRadius: 20, backgroundColor: 'rgba(18, 18, 24, 0.9)', border: '1.5px solid rgba(255, 255, 255, 0.08)', padding: '24px 28px', boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.4)' };

  return (
    <div ref={workspaceRef} className={isEditor ? 'vscode-workspace' : 'explorer-page'} style={isEditor ? undefined : { padding: 24, display: 'flex', flexDirection: 'column', gap: 20, width: '100%', boxSizing: 'border-box' }}>
      <div className={isEditor ? 'vscode-titlebar' : undefined} style={isEditor ? undefined : { ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
        {isEditor ? <>
          <div className="vscode-workspace-title"><FileCode2 size={17} /><h1>Code Editor</h1><span>/</span><span title={repository?.root_path}>{repository?.name ?? 'No folder opened'}</span></div>
          <button type="button" className="vscode-command-search" disabled={!tree} onClick={() => { setFileQuery(''); setQuickIndex(0); setShowQuickOpen(true); }}><Search size={13} /><span>Search files by name</span><kbd>Ctrl/Cmd P</kbd></button>
          <div className="vscode-layout-actions">
            <button type="button" aria-label="Toggle file explorer" aria-pressed={showExplorer} title="Toggle file explorer" onClick={() => setShowExplorer(value => !value)}><PanelLeft size={16} /></button>
            <button type="button" aria-label="Toggle word wrap" aria-pressed={settings.wordWrap} title="Toggle word wrap" onClick={() => updateSettings({ wordWrap: !settings.wordWrap })}><WrapText size={16} /></button>
            <button type="button" aria-label="Toggle symbol outline" aria-pressed={showOutline} title="Toggle symbol outline" onClick={() => setShowOutline(value => !value)}><PanelRight size={16} /></button>
          </div>
        </> : <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Files size={32} color="#60a5fa" />
            <div><h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 600, color: 'white' }}>File Explorer</h1><p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>Browse, inspect, and edit your workspace files</p></div>
          </div>
          <div style={{ minWidth: 300 }}><RepositoryPicker isLoading={isLoading} onOpen={onOpen} /></div>
        </>}
      </div>

      {!isEditor && repository && <div style={{ ...cardStyle, padding: '20px 28px' }}><RepositorySummary repository={repository} /></div>}

      {isEditor && filesError && <div role="alert">{filesError}<button type="button" onClick={() => setRefreshVersion(value => value + 1)}>Retry loading files</button></div>}
      {isEditor && repository && !tree ? <div className="vscode-welcome"><p>{filesLoading ? 'Loading local files…' : 'Local files are unavailable.'}</p></div> : !tree ? (
        <div className={isEditor ? 'vscode-welcome' : undefined} style={isEditor ? undefined : { ...cardStyle, padding: '80px 40px', textAlign: 'center' }}>
          <FileCode2 size={78} strokeWidth={1} className="vscode-welcome-mark" />
          <h2>{isEditor ? 'Your code. Your workspace.' : 'No Workspace Open'}</h2>
          <p>Open a project folder to browse and edit your files.</p>
          {isEditor ? <button type="button" className="vscode-open-folder" disabled={isLoading} onClick={() => setShowFolderPicker(true)}><FolderOpen size={16} />Open Folder</button> : <p>Choose a folder with the repository picker above.</p>}
          {isEditor && <div className="vscode-welcome-shortcuts"><span>Save file <kbd>Ctrl/Cmd S</kbd></span><span>Find in file <kbd>Ctrl/Cmd F</kbd></span></div>}
        </div>
      ) : (
        <div className={isEditor ? 'vscode-workspace-body' : 'explorer-workspace-grid'} style={isEditor ? { '--editor-sidebar-width': showExplorer ? sidebarWidth + 'px' : '0px', '--editor-resizer-width': showExplorer ? '4px' : '0px' } as CSSProperties : { gap: 20, minHeight: 620, height: 'calc(100vh - 310px)' }}>
          <aside className={isEditor ? 'vscode-explorer' : undefined} style={isEditor ? { display: showExplorer ? 'flex' : 'none' } : { ...cardStyle, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 18 }} aria-label="Project files">
            <div className={isEditor ? 'vscode-explorer-heading' : undefined}>
              <h2>{isEditor ? 'EXPLORER' : 'Project Files'}</h2>
              {isEditor && <button type="button" aria-label="Refresh local files" title="Refresh local files" disabled={filesLoading} onClick={() => setRefreshVersion(value => value + 1)}><RefreshCw size={15} /></button>}
              {isEditor && <button type="button" aria-label="Open project folder" title="Open project folder" disabled={isLoading} onClick={() => setShowFolderPicker(true)}><FolderOpen size={15} /></button>}
            </div>
            {isEditor && openFiles.length > 0 && <div className="vscode-open-editors">
              <h3><ChevronDown size={13} /> OPEN EDITORS <span>{openFiles.length}</span></h3>
              {openFiles.map(file => <button type="button" key={file.file_id} className={file.file_id === selectedFile?.file_id ? 'is-selected' : ''} onClick={() => onSelectFile(file)}><FileCode2 size={13} className={'file-color-' + (file.language ?? 'other')} /><span>{file.name}</span></button>)}
            </div>}
            <div className="vscode-project-tree" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}><RepositoryTree root={tree} onSelectFile={onSelectFile} selectedFilePath={selectedFile?.path} /></div>
          </aside>

          {isEditor && <div className="vscode-sidebar-resizer" role="separator" aria-label="Resize file explorer" aria-orientation="vertical" aria-valuenow={sidebarWidth} aria-valuemin={180} aria-valuemax={400} tabIndex={showExplorer ? 0 : -1}
            onPointerDown={event => { dragStart.current = { x: event.clientX, width: sidebarWidth }; event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={event => { if (dragStart.current) setSidebarWidth(Math.max(180, Math.min(400, dragStart.current.width + event.clientX - dragStart.current.x))); }}
            onPointerUp={event => { dragStart.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
            onPointerCancel={() => { dragStart.current = null; }}
            onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setSidebarWidth(width => Math.max(180, Math.min(400, width + (event.key === 'ArrowLeft' ? -20 : 20)))); } }}
          />}

          <div className={isEditor ? 'vscode-editor-pane' : undefined} style={isEditor ? undefined : { minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {!selectedFile ? (
              <div className={isEditor ? 'vscode-welcome' : undefined} style={isEditor ? undefined : { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 20 }}>
                <FileCode2 size={86} strokeWidth={0.8} className="vscode-welcome-mark" />
                <h2>{isEditor ? repository?.name ?? 'Code Editor' : 'No File Selected'}</h2>
                <p>{isEditor ? 'Select a file in the explorer to start editing.' : 'Select a file from the explorer to view its details and contents.'}</p>
                {isEditor && <div className="vscode-welcome-shortcuts">
                  <button type="button" onClick={() => { setFileQuery(''); setQuickIndex(0); setShowQuickOpen(true); }}>Go to File <kbd>Ctrl/Cmd P</kbd></button>
                  <span>Save file <kbd>Ctrl/Cmd S</kbd></span><span>Find in file <kbd>Ctrl/Cmd F</kbd></span>
                </div>}
              </div>
            ) : <FileInspector key={selectedFile.file_id} file={selectedFile} onClose={closeSelectedFile} onAskAI={selectedFile.file_id !== null && selectedFile.file_id < 0 ? undefined : onAskAI} onEditorStateChange={onEditorStateChange} onSaved={fileSaved} localRepositoryId={selectedFile.file_id !== null && selectedFile.file_id < 0 ? repository?.id : undefined} readOnly={isLoading} autoEdit={isEditor} openFiles={openFiles.filter(file => isEditor || (file.file_id !== null && file.file_id >= 0))} onSelectOpenFile={onSelectFile} onCloseOpenFile={file => setOpenFiles(current => current.filter(open => open.file_id !== file.file_id))} outlineVisible={!isEditor || showOutline} />}
          </div>
        </div>
      )}

      {isEditor && <footer className="vscode-workspace-status" aria-label="Workspace status">
        <div><span className="vscode-remote-mark"><FileCode2 size={13} /></span><span><GitBranch size={12} />{repository?.current_branch ?? 'Local workspace'}</span></div>
        <div><span>{isLoading ? 'Opening project…' : filesLoading ? 'Loading local files…' : files.length + ' files'}</span><span>IFROG</span></div>
      </footer>}

      <DialogPrimitive.Root open={isEditor && (showQuickOpen || showFolderPicker)} onOpenChange={open => { if (!open) { setShowQuickOpen(false); setShowFolderPicker(false); } }}>
        <DialogPrimitive.Portal container={workspaceRef.current}>
          <DialogPrimitive.Overlay asChild><div className="vscode-dialog-backdrop" onClick={() => { setShowQuickOpen(false); setShowFolderPicker(false); }}>
          <DialogPrimitive.Content asChild onCloseAutoFocus={event => { event.preventDefault(); workspaceRef.current?.querySelector<HTMLElement>('[role="textbox"][aria-label^="Edit "]')?.focus(); }}>
        <section className={'vscode-dialog ' + (showQuickOpen ? 'vscode-quick-open' : '')} onClick={event => event.stopPropagation()}>
          <DialogPrimitive.Title className="sr-only">{showQuickOpen ? 'Go to file' : 'Open project folder'}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{showQuickOpen ? 'Search and select a file in your project.' : 'Choose a local folder to open in your workspace.'}</DialogPrimitive.Description>
          <header><span>{showQuickOpen ? 'GO TO FILE' : 'OPEN FOLDER'}</span><button type="button" aria-label="Close dialog" onClick={() => { setShowQuickOpen(false); setShowFolderPicker(false); }}><X size={15} /></button></header>
          {showQuickOpen ? <>
            <Input ref={quickInputRef} aria-label="Search project files" placeholder="Search files by name or path…" value={fileQuery} onChange={event => { setFileQuery(event.target.value); setQuickIndex(0); }} onKeyDown={event => {
              if (event.key === 'ArrowDown') { event.preventDefault(); setQuickIndex(index => Math.max(0, Math.min(matches.length - 1, index + 1))); }
              if (event.key === 'ArrowUp') { event.preventDefault(); setQuickIndex(index => Math.max(0, index - 1)); }
              if (event.key === 'Enter' && matches[quickIndex]) { event.preventDefault(); openFromSearch(matches[quickIndex]); }
            }} />
            <div className="vscode-quick-results">{matches.map((file, index) => <button type="button" key={file.file_id} className={index === quickIndex ? 'is-selected' : ''} onClick={() => openFromSearch(file)}><FileCode2 size={15} className={'file-color-' + (file.language ?? 'other')} /><span>{file.name}<small>{file.path}</small></span></button>)}{matches.length === 0 && <p>No matching files.</p>}</div>
          </> : <RepositoryPicker isLoading={isLoading} onOpen={async path => { await onOpen(path); setShowFolderPicker(false); }} />}
        </section>
          </DialogPrimitive.Content>
          </div></DialogPrimitive.Overlay>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}

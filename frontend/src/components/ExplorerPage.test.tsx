import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { editorApi } from '../api/editorApi';
import type { RepositoryInfo, TreeNode } from '../types/domain';
import { ExplorerPage } from './ExplorerPage';

vi.mock('../api/editorApi', () => ({ editorApi: { getTree: vi.fn() } }));
vi.mock('./FileInspector', () => ({ FileInspector: ({ localRepositoryId, onAskAI }: { file: TreeNode; localRepositoryId?: number; onAskAI?: unknown }) => {
  const [draft, setDraft] = useState('');
  return <><input aria-label="Test draft" value={draft} onChange={event => setDraft(event.target.value)} /><span data-testid="file-source">{localRepositoryId === undefined ? 'indexed' : `local:${localRepositoryId}`}</span><span data-testid="ask-ai">{String(Boolean(onAskAI))}</span></>;
} }));
const repository: RepositoryInfo = { id: 4, name: 'project', root_path: '/project', current_branch: 'main', head_commit: null, opened_at: null, file_count: 1 };
const source: TreeNode = { name: 'app.ts', path: 'app.ts', is_directory: false, children: [], file_id: 8, language: 'typescript', size_bytes: 3 };
const env: TreeNode = { name: '.env', path: '.env', is_directory: false, children: [], file_id: -9, language: 'other', size_bytes: 3 };
const indexedTree: TreeNode = { name: 'project', path: '', is_directory: true, children: [source], file_id: null, language: null, size_bytes: null };
const completeTree = { ...indexedTree, children: [source, env] };
const props = { repository, tree: indexedTree, selectedFile: null, isLoading: false, onOpen: vi.fn(), onSelectFile: vi.fn(), onCloseFile: vi.fn(), onAskAI: vi.fn() };

describe('Code Editor local file list', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); vi.mocked(editorApi.getTree).mockResolvedValue(completeTree); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('requests all files only in editor mode, and restores the filtered explorer list', async () => {
    const view = render(<ExplorerPage {...props} mode="explorer" />);
    expect(editorApi.getTree).not.toHaveBeenCalled();
    expect(screen.queryByRole('treeitem', { name: '.env' })).not.toBeInTheDocument();
    view.rerender(<ExplorerPage {...props} mode="editor" />);
    fireEvent.click(await screen.findByRole('treeitem', { name: '.env' }));
    expect(props.onSelectFile).toHaveBeenCalledWith(env);
    expect(editorApi.getTree).toHaveBeenCalledWith(4);
    view.rerender(<ExplorerPage {...props} mode="explorer" />);
    expect(screen.queryByRole('treeitem', { name: '.env' })).not.toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'app.ts' })).toBeInTheDocument();
  });

  it('refreshes local files and includes ignored files in quick open', async () => {
    render(<ExplorerPage {...props} mode="editor" />);
    await screen.findByRole('treeitem', { name: '.env' });
    fireEvent.click(screen.getByRole('button', { name: /Search files by name/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search project files' }), { target: { value: '.env' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search project files' }), { key: 'Enter' });
    expect(props.onSelectFile).toHaveBeenCalledWith(env);
    const newFile = { ...env, name: '.env.local', path: '.env.local', file_id: -10 };
    vi.mocked(editorApi.getTree).mockResolvedValue({ ...completeTree, children: [...completeTree.children, newFile] });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh local files' }));
    expect(await screen.findByRole('treeitem', { name: '.env.local' })).toBeInTheDocument();
  });

  it('keeps an indexed draft mounted while loading the complete tree and switching modes', async () => {
    let finish!: (tree: TreeNode) => void;
    vi.mocked(editorApi.getTree).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const view = render(<ExplorerPage {...props} selectedFile={source} mode="explorer" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Test draft' }), { target: { value: 'unsaved' } });
    view.rerender(<ExplorerPage {...props} selectedFile={source} mode="editor" />);
    expect(screen.getByRole('textbox', { name: 'Test draft' })).toHaveValue('unsaved');
    finish(completeTree);
    await screen.findByRole('treeitem', { name: '.env' });
    expect(screen.getByRole('textbox', { name: 'Test draft' })).toHaveValue('unsaved');
    view.rerender(<ExplorerPage {...props} selectedFile={source} mode="explorer" />);
    expect(screen.getByRole('textbox', { name: 'Test draft' })).toHaveValue('unsaved');
  });

  it('uses local access for editor-only files and keeps them out of Ask AI', async () => {
    render(<ExplorerPage {...props} selectedFile={env} mode="editor" />);
    await screen.findByRole('treeitem', { name: '.env' });
    expect(screen.getByTestId('file-source')).toHaveTextContent('local:4');
    expect(screen.getByTestId('ask-ai')).toHaveTextContent('false');
  });

  it('shows a load failure and supports retry', async () => {
    vi.mocked(editorApi.getTree).mockRejectedValueOnce(new Error('Folder unavailable'));
    render(<ExplorerPage {...props} mode="editor" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Folder unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading files' }));
    await screen.findByRole('treeitem', { name: '.env' });
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});

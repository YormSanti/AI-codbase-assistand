import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TreeNode } from "../types/domain";
import type { FileInspectorHandle } from "../components/FileInspector";
import { useWorkspaceCloseGuard, type EditorStatus } from "./useWorkspaceCloseGuard";
import type { EditorCommand } from "./editorCommands";

interface Props {
  selectedFile: TreeNode | null;
  onSelectFile: (file: TreeNode) => void;
  onCloseFile: () => void;
  onStateChange?: (status: EditorStatus) => void;
}

export function useEditorDocuments({ selectedFile, onSelectFile, onCloseFile, onStateChange }: Props) {
  const [opened, setOpened] = useState<TreeNode[]>(selectedFile ? [selectedFile] : []);
  const [states, setStates] = useState<Record<string, EditorStatus>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const statusRef = useRef<Record<string, EditorStatus>>({});
  const reporters = useRef(new Map<string, (status: EditorStatus) => void>());
  const handles = useRef(new Map<string, FileInspectorHandle>());
  const handleRefs = useRef(new Map<string, (handle: FileInspectorHandle | null) => void>());
  const savingAll = useRef(false);
  const stateChange = useRef(onStateChange);
  stateChange.current = onStateChange;
  const openFiles = useMemo(() => selectedFile && !opened.some(file => file.path === selectedFile.path)
    ? [...opened, selectedFile] : opened, [opened, selectedFile]);
  const dirtyCount = Object.values(states).filter(state => state.dirty).length;
  const saving = Object.values(states).some(state => state.saving);
  useWorkspaceCloseGuard({ dirty: dirtyCount > 0, saving });

  useEffect(() => {
    if (!selectedFile) return;
    setOpened(current => current.some(file => file.path === selectedFile.path) ? current : [...current, selectedFile]);
  }, [selectedFile]);

  const reportSummary = useCallback(() => {
    const statuses = Object.values(statusRef.current);
    stateChange.current?.({ dirty: statuses.some(status => status.dirty), saving: statuses.some(status => status.saving) });
  }, []);

  useEffect(() => () => { stateChange.current?.({ dirty: false, saving: false }); }, []);

  const reporterFor = (path: string) => {
    let report = reporters.current.get(path);
    if (!report) {
      report = status => {
        const previous = statusRef.current[path];
        if (previous?.dirty === status.dirty && previous?.saving === status.saving) return;
        if (status.dirty && !previous?.dirty) setNotice(null);
        statusRef.current = { ...statusRef.current, [path]: status };
        setStates(statusRef.current);
        reportSummary();
      };
      reporters.current.set(path, report);
    }
    return report;
  };

  const refFor = (path: string) => {
    let ref = handleRefs.current.get(path);
    if (!ref) {
      ref = handle => { if (handle) handles.current.set(path, handle); else handles.current.delete(path); };
      handleRefs.current.set(path, ref);
    }
    return ref;
  };

  const closeFile = (file: TreeNode, confirmed = false) => {
    const state = statusRef.current[file.path];
    if (state?.saving || savingAll.current) return;
    if (!confirmed && state?.dirty && !window.confirm(`Discard unsaved changes in ${file.name} and close this file?`)) return;
    const index = openFiles.findIndex(open => open.path === file.path);
    const remaining = openFiles.filter(open => open.path !== file.path);
    setOpened(remaining);
    delete statusRef.current[file.path];
    setStates({ ...statusRef.current });
    reportSummary();
    if (selectedFile?.path === file.path) {
      const next = remaining[Math.min(index, remaining.length - 1)];
      if (next) onSelectFile(next); else onCloseFile();
    }
  };

  const saveAll = async () => {
    if (savingAll.current || saving) return;
    const dirty = openFiles.filter(file => statusRef.current[file.path]?.dirty);
    if (!dirty.length) return;
    savingAll.current = true;
    setNotice(null);
    try {
      const results = await Promise.all(dirty.map(file => handles.current.get(file.path)?.save() ?? Promise.resolve(false)));
      const failures = dirty.filter((_, index) => !results[index]);
      setNotice(failures.length ? `Could not save ${failures.map(file => file.name).join(', ')}. Your drafts are kept.` : `Saved ${dirty.length} ${dirty.length === 1 ? 'file' : 'files'}.`);
      if (failures.length) onSelectFile(failures[0]);
    } finally { savingAll.current = false; }
  };

  const focusSelected = () => { if (selectedFile) handles.current.get(selectedFile.path)?.focus(); };
  const runSelectedCommand = (command: EditorCommand) => { if (selectedFile) handles.current.get(selectedFile.path)?.runCommand(command); };
  return { openFiles, states, dirtyCount, saving, notice, reporterFor, refFor, closeFile, saveAll, focusSelected, runSelectedCommand };
}

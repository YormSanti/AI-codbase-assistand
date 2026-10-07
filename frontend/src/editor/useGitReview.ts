import { useEffect, useState } from "react";
import { gitApi } from "../api/gitApi";
import type { GitChange, GitDiff, GitStatus } from "../types/git";

export type ChangeGroup = "conflicts" | "staged" | "changes";
export interface GitSelection { path: string; group: ChangeGroup }
export function isConflict(change: GitChange) {
  return change.index_status === "U" || change.worktree_status === "U" || ["AA", "DD"].includes(change.index_status + change.worktree_status);
}
export function groupChanges(changes: GitChange[], group: ChangeGroup) {
  return changes.filter(change => group === "conflicts" ? isConflict(change) : !isConflict(change) && (group === "staged"
    ? change.index_status !== " " && change.index_status !== "?"
    : change.index_status === "?" || change.worktree_status !== " "));
}

export function useGitReview(repositoryId: number | null, active: boolean) {
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<(GitSelection & { repositoryId: number }) | null>(null);
  const [snapshot, setSnapshot] = useState<{ repositoryId: number; data: GitStatus | null; loading: boolean; error: string | null } | null>(null);
  const [diff, setDiff] = useState<{ key: string; data: GitDiff | null; loading: boolean; error: string | null } | null>(null);
  const selection = selected?.repositoryId === repositoryId ? selected : null;
  const status = snapshot?.repositoryId === repositoryId ? snapshot.data : null;
  const loading = repositoryId !== null && (snapshot?.repositoryId !== repositoryId || snapshot.loading);
  const error = snapshot?.repositoryId === repositoryId ? snapshot.error : null;
  const diffKey = selection ? `${repositoryId}:${selection.group}:${selection.path}` : null;

  useEffect(() => {
    if (!active || repositoryId === null) return;
    const refreshOnFocus = () => setVersion(value => value + 1);
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [active, repositoryId]);

  useEffect(() => {
    if (!active || repositoryId === null) return;
    let current = true;
    setSnapshot(previous => ({ repositoryId, data: previous?.repositoryId === repositoryId ? previous.data : null, loading: true, error: null }));
    void gitApi.getStatus(repositoryId).then(data => {
      if (!current) return;
      setSnapshot({ repositoryId, data, loading: false, error: null });
      setSelected(previous => previous?.repositoryId === repositoryId && groupChanges(data.changes, previous.group).some(change => change.path === previous.path) ? previous : null);
    }).catch(reason => {
      if (current) setSnapshot(previous => ({ repositoryId, data: previous?.repositoryId === repositoryId ? previous.data : null, loading: false, error: reason instanceof Error ? reason.message : "Could not load Git status." }));
    });
    return () => { current = false; };
  }, [active, repositoryId, version]);

  useEffect(() => {
    if (!active || !selection || !diffKey || repositoryId === null) return;
    let current = true;
    setDiff({ key: diffKey, data: null, loading: true, error: null });
    void gitApi.getDiff(repositoryId, selection.path, selection.group === "staged").then(data => {
      if (current) setDiff({ key: diffKey, data, loading: false, error: null });
    }).catch(reason => {
      if (current) setDiff({ key: diffKey, data: null, loading: false, error: reason instanceof Error ? reason.message : "Could not load this diff." });
    });
    return () => { current = false; };
  }, [active, repositoryId, selection, diffKey, version]);

  return {
    status, loading, error, selection,
    patch: diff?.key === diffKey ? diff.data : null,
    diffLoading: Boolean(selection) && (diff?.key !== diffKey || diff.loading),
    diffError: diff?.key === diffKey ? diff.error : null,
    select: (next: GitSelection | null) => setSelected(next && repositoryId !== null ? { ...next, repositoryId } : null),
    refresh: () => setVersion(value => value + 1),
  };
}

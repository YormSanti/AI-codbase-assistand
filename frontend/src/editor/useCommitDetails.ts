import { useEffect, useState } from "react";
import { gitApi } from "../api/gitApi";
import type { CommitDetails, GitDiff } from "../types/git";

interface Loaded<T> { key: string; data: T | null; error: string | null }

const message = (reason: unknown, fallback: string) => reason instanceof Error ? reason.message : fallback;

/** One commit's details and the diff of the selected file; late responses for other commits are ignored. */
export function useCommitDetails(repositoryId: number | null, sha: string | null) {
  const key = repositoryId !== null && sha ? `${repositoryId}:${sha}` : null;
  const [details, setDetails] = useState<Loaded<CommitDetails> | null>(null);
  const [selected, setSelected] = useState<{ key: string; path: string } | null>(null);
  const [diff, setDiff] = useState<Loaded<GitDiff> | null>(null);
  const file = selected?.key === key ? selected.path : null;
  const diffKey = key && file ? `${key}:${file}` : null;

  useEffect(() => {
    if (!key || repositoryId === null || !sha) return;
    let current = true;
    setDetails({ key, data: null, error: null });
    gitApi.getCommit(repositoryId, sha).then(data => {
      if (!current) return;
      setDetails({ key, data, error: null });
      setSelected(data.files[0] ? { key, path: data.files[0].path } : null);
    }).catch(reason => { if (current) setDetails({ key, data: null, error: message(reason, "Could not read this commit.") }); });
    return () => { current = false; };
  }, [key, repositoryId, sha]);

  useEffect(() => {
    if (!diffKey || repositoryId === null || !sha || !file) return;
    let current = true;
    setDiff({ key: diffKey, data: null, error: null });
    gitApi.getCommitDiff(repositoryId, sha, file)
      .then(data => { if (current) setDiff({ key: diffKey, data, error: null }); })
      .catch(reason => { if (current) setDiff({ key: diffKey, data: null, error: message(reason, "Could not load this diff.") }); });
    return () => { current = false; };
  }, [diffKey, repositoryId, sha, file]);

  const loaded = details?.key === key ? details : null;
  const loadedDiff = diff?.key === diffKey ? diff : null;
  return {
    details: loaded?.data ?? null,
    loading: Boolean(key) && !loaded?.data && !loaded?.error,
    error: loaded?.error ?? null,
    file,
    selectFile: (path: string) => { if (key) setSelected({ key, path }); },
    patch: loadedDiff?.data ?? null,
    diffLoading: Boolean(diffKey) && !loadedDiff?.data && !loadedDiff?.error,
    diffError: loadedDiff?.error ?? null,
  };
}

import { useCallback, useEffect, useState } from "react";
import { gitApi } from "../api/gitApi";
import type { GitStatus } from "../types/git";
import { useAppSettings } from "./useAppSettings";

interface Snapshot {
  repositoryId: number | null;
  status: GitStatus | null;
  loading: boolean;
  error: string | null;
}

/**
 * Live Git status for the selected project. Refreshes on demand, when the
 * window regains focus, and on the interval chosen in Settings.
 */
export function useGitStatus(repositoryId: number | null, active = true) {
  const { settings } = useAppSettings();
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot>({ repositoryId, status: null, loading: false, error: null });
  const refresh = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    if (!active || repositoryId === null) return;
    let current = true;
    setSnapshot(previous => ({ repositoryId, status: previous.repositoryId === repositoryId ? previous.status : null, loading: true, error: null }));
    void gitApi.getStatus(repositoryId).then(status => {
      if (current) setSnapshot({ repositoryId, status, loading: false, error: null });
    }).catch(reason => {
      if (!current) return;
      const message = reason instanceof Error ? reason.message : "Could not load Git status.";
      setSnapshot(previous => ({ repositoryId, status: previous.repositoryId === repositoryId ? previous.status : null, loading: false, error: message }));
    });
    return () => { current = false; };
  }, [active, repositoryId, version]);

  useEffect(() => {
    if (!active || repositoryId === null) return;
    window.addEventListener("focus", refresh);
    const interval = settings.gitRefreshInterval > 0 ? window.setInterval(refresh, settings.gitRefreshInterval * 1000) : null;
    return () => {
      window.removeEventListener("focus", refresh);
      if (interval !== null) window.clearInterval(interval);
    };
  }, [active, repositoryId, refresh, settings.gitRefreshInterval]);

  const matches = snapshot.repositoryId === repositoryId;
  return {
    status: matches ? snapshot.status : null,
    loading: repositoryId !== null && (!matches || snapshot.loading),
    error: matches ? snapshot.error : null,
    refresh,
  };
}

import { apiRequest } from "./client";
import type { RepositoryInfo, SymbolMatch, TreeNode } from "../types/domain";

// React development-mode startup can restore the same project twice.
// Share concurrent opens so indexing and SQLite inserts do not race.
const pendingOpens = new Map<string, Promise<RepositoryInfo>>();

export const repositoryApi = {
  open(path: string): Promise<RepositoryInfo> {
    const pending = pendingOpens.get(path);
    if (pending) return pending;
    const request = apiRequest<RepositoryInfo>("/api/repositories/open", {
      method: "POST",
      body: JSON.stringify({ path }),
    }).finally(() => pendingOpens.delete(path));
    pendingOpens.set(path, request);
    return request;
  },

  list(): Promise<RepositoryInfo[]> {
    return apiRequest<RepositoryInfo[]>("/api/repositories");
  },

  /** Rescan the working tree and rebuild symbols for every file. */
  reindex(repositoryId: number): Promise<RepositoryInfo> {
    return apiRequest<RepositoryInfo>(`/api/repositories/${repositoryId}/reindex`, { method: "POST" });
  },

  remove(repositoryId: number): Promise<void> {
    return apiRequest<void>(`/api/repositories/${repositoryId}`, {
      method: "DELETE",
    });
  },

  /** Indexed classes, functions, and methods whose name contains `query`, best matches first. */
  searchSymbols(repositoryId: number, query: string, limit = 50): Promise<SymbolMatch[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return apiRequest<SymbolMatch[]>(`/api/repositories/${repositoryId}/symbols?${params}`);
  },

  getTree(repositoryId: number): Promise<TreeNode> {
    return apiRequest<TreeNode>(`/api/repositories/${repositoryId}/tree`);
  },
};

import { apiRequest } from "./client";
import type { RepositoryInfo, TreeNode } from "../types/domain";

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

  remove(repositoryId: number): Promise<void> {
    return apiRequest<void>(`/api/repositories/${repositoryId}`, {
      method: "DELETE",
    });
  },

  getTree(repositoryId: number): Promise<TreeNode> {
    return apiRequest<TreeNode>(`/api/repositories/${repositoryId}/tree`);
  },
};

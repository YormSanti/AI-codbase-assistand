import { apiRequest } from "./client";
import type { RepositoryInfo, TreeNode } from "../types/domain";

export const repositoryApi = {
  open(path: string): Promise<RepositoryInfo> {
    return apiRequest<RepositoryInfo>("/api/repositories/open", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
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

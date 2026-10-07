import { apiRequest } from "./client";
import type { GitDiff, GitStatus } from "../types/git";

export const gitApi = {
  getStatus(repositoryId: number): Promise<GitStatus> {
    return apiRequest<GitStatus>(`/api/repositories/${repositoryId}/git`);
  },
  getDiff(repositoryId: number, path: string, staged: boolean): Promise<GitDiff> {
    const params = new URLSearchParams({ path, staged: String(staged) });
    return apiRequest<GitDiff>(`/api/repositories/${repositoryId}/git/diff?${params}`);
  },
};

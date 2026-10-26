import { apiRequest } from "./client";
import type { CommitDetails, GitDiff, GitStatus, StagedDiff } from "../types/git";

export const gitApi = {
  getStatus(repositoryId: number): Promise<GitStatus> {
    return apiRequest<GitStatus>(`/api/repositories/${repositoryId}/git`);
  },
  getDiff(repositoryId: number, path: string, staged: boolean): Promise<GitDiff> {
    const params = new URLSearchParams({ path, staged: String(staged) });
    return apiRequest<GitDiff>(`/api/repositories/${repositoryId}/git/diff?${params}`);
  },
  /** Message, author, parents, and changed files of one commit. */
  getCommit(repositoryId: number, sha: string): Promise<CommitDetails> {
    return apiRequest<CommitDetails>(`/api/repositories/${repositoryId}/git/commits/${encodeURIComponent(sha)}`);
  },
  /** One changed file's patch within a commit, compared with its first parent. */
  getCommitDiff(repositoryId: number, sha: string, path: string): Promise<GitDiff> {
    const params = new URLSearchParams({ path });
    return apiRequest<GitDiff>(`/api/repositories/${repositoryId}/git/commits/${encodeURIComponent(sha)}/diff?${params}`);
  },
  /** Combined patch, stat, and file count of everything staged. */
  getStagedDiff(repositoryId: number): Promise<StagedDiff> {
    return apiRequest<StagedDiff>(`/api/repositories/${repositoryId}/git/staged-diff`);
  },
  /** Stage the given changed paths; resolves with the refreshed status. */
  stage(repositoryId: number, paths: string[]): Promise<GitStatus> {
    return apiRequest<GitStatus>(`/api/repositories/${repositoryId}/git/stage`, { method: "POST", body: JSON.stringify({ paths }) });
  },
  /** Remove the given paths from the index, keeping working tree edits. */
  unstage(repositoryId: number, paths: string[]): Promise<GitStatus> {
    return apiRequest<GitStatus>(`/api/repositories/${repositoryId}/git/unstage`, { method: "POST", body: JSON.stringify({ paths }) });
  },
  /** Commit the index with `message`; resolves with the refreshed status. */
  commit(repositoryId: number, message: string): Promise<GitStatus> {
    return apiRequest<GitStatus>(`/api/repositories/${repositoryId}/git/commit`, { method: "POST", body: JSON.stringify({ message }) });
  },
};

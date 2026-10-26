import { apiRequest } from "./client";
import type { BranchList, CommitDetails, GitDiff, GitStatus, StagedDiff } from "../types/git";

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
  /** Local branches, most recently committed first, and the checked-out branch. */
  listBranches(repositoryId: number): Promise<BranchList> {
    return apiRequest<BranchList>(`/api/repositories/${repositoryId}/git/branches`);
  },
  /** Check out an existing local branch; refused while tracked files have changes. */
  switchBranch(repositoryId: number, branch: string): Promise<GitStatus> {
    return apiRequest<GitStatus>(`/api/repositories/${repositoryId}/git/checkout`, { method: "POST", body: JSON.stringify({ branch }) });
  },
  /** Create a branch at HEAD and switch to it. */
  createBranch(repositoryId: number, name: string): Promise<GitStatus> {
    return apiRequest<GitStatus>(`/api/repositories/${repositoryId}/git/branches`, { method: "POST", body: JSON.stringify({ name, checkout: true }) });
  },
  /** Fetch every remote (with prune); the refreshed status carries the new behind count. */
  fetch(repositoryId: number): Promise<GitStatus> {
    return apiRequest<GitStatus>(`/api/repositories/${repositoryId}/git/fetch`, { method: "POST" });
  },
  /** Fast-forward the current branch to its upstream; fails rather than merging diverged history. */
  pull(repositoryId: number): Promise<GitStatus> {
    return apiRequest<GitStatus>(`/api/repositories/${repositoryId}/git/pull`, { method: "POST" });
  },
  /** Push the current branch, publishing it with an upstream on the first push. Never forces. */
  push(repositoryId: number): Promise<GitStatus> {
    return apiRequest<GitStatus>(`/api/repositories/${repositoryId}/git/push`, { method: "POST" });
  },
  /** Discard working-tree changes (untracked files are deleted); resolves with the refreshed status. */
  discard(repositoryId: number, paths: string[]): Promise<GitStatus> {
    return apiRequest<GitStatus>(`/api/repositories/${repositoryId}/git/discard`, { method: "POST", body: JSON.stringify({ paths }) });
  },
  /** Commit the index with `message`; resolves with the refreshed status. */
  commit(repositoryId: number, message: string): Promise<GitStatus> {
    return apiRequest<GitStatus>(`/api/repositories/${repositoryId}/git/commit`, { method: "POST", body: JSON.stringify({ message }) });
  },
};

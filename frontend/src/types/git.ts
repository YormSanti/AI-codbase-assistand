export interface GitChange {
  path: string;
  index_status: string;
  worktree_status: string;
  original_path: string | null;
}

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  committed_at: string;
}

export interface GitStatus {
  branch: string | null;
  head_commit: string | null;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  remote_url: string | null;
  changes: GitChange[];
  commits: GitCommit[];
}

export interface GitDiff {
  path: string;
  staged: boolean;
  content: string;
  is_binary: boolean;
  truncated: boolean;
}

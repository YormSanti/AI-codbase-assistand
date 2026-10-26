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

export interface StagedDiff {
  content: string;
  stat: string;
  files: number;
  truncated: boolean;
}

export interface CommitFile {
  path: string;
  /** A, M, D, R (renamed), C (copied), or T (type change). */
  status: string;
  original_path: string | null;
  /** Null for binary files. */
  additions: number | null;
  deletions: number | null;
}

export interface CommitDetails {
  sha: string;
  message: string;
  author: string;
  author_email: string;
  committed_at: string;
  parents: string[];
  files: CommitFile[];
}

export interface BranchInfo {
  name: string;
  upstream: string | null;
  subject: string;
  committed_at: string | null;
}

export interface BranchList {
  /** Checked-out branch (also one without commits yet); null when HEAD is detached. */
  current: string | null;
  detached: boolean;
  /** Local branches, most recently committed first. */
  branches: BranchInfo[];
}

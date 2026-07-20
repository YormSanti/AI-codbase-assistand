// Mirrors backend/app/api/schemas.py — kept in sync by hand for now.
// If the contract grows, generate this from the FastAPI OpenAPI schema instead.

export type Language =
  | "python"
  | "typescript"
  | "javascript"
  | "tsx"
  | "jsx"
  | "rust"
  | "go"
  | "java"
  | "c"
  | "cpp"
  | "csharp"
  | "ruby"
  | "php"
  | "json"
  | "yaml"
  | "toml"
  | "markdown"
  | "html"
  | "css"
  | "shell"
  | "sql"
  | "other";

export interface RepositoryInfo {
  id: number;
  name: string;
  root_path: string;
  current_branch: string | null;
  head_commit: string | null;
  opened_at: string | null;
  file_count: number;
}

export interface TreeNode {
  name: string;
  path: string;
  is_directory: boolean;
  language: Language | null;
  size_bytes: number | null;
  children: TreeNode[];
}

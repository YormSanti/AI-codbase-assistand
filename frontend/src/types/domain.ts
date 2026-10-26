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
  file_id: number | null;
  children: TreeNode[];
}

export type SymbolKind = "class" | "function" | "method" | "import";

export interface CodeSymbol {
  id: number;
  name: string;
  kind: SymbolKind;
  parent_name: string | null;
  start_line: number;
  end_line: number;
}

export interface FilePreview {
  file_id: number;
  path: string;
  content: string | null;
  is_binary: boolean;
  truncated: boolean;
  content_hash?: string | null;
  size_bytes?: number | null;
  editable?: boolean;
  editing_disabled_reason?: string | null;
}

export interface SearchMatch {
  path: string;
  line: number;
  column: number;
  text: string;
}

export interface SearchResults {
  query: string;
  matches: SearchMatch[];
  files_scanned: number;
  truncated: boolean;
}

export interface SymbolMatch {
  name: string;
  kind: SymbolKind;
  path: string;
  start_line: number;
  end_line: number;
  parent_name: string | null;
}

export type HealthCategory = "secret" | "risk" | "marker";
export type HealthSeverity = "high" | "medium" | "low" | "info";

export interface HealthFinding {
  category: HealthCategory;
  rule: string;
  severity: HealthSeverity;
  title: string;
  path: string;
  line: number;
  /** The source line; detected secrets are redacted by the backend. */
  snippet: string;
}

export interface HealthReport {
  files_scanned: number;
  findings: HealthFinding[];
  large_files: { path: string; size_bytes: number }[];
  counts: Record<HealthCategory, number>;
  truncated: boolean;
}

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import { gitApi } from "../api/gitApi";
import { healthApi } from "../api/healthApi";
import type { RepositoryInfo, TreeNode } from "../types/domain";
import type { GitStatus } from "../types/git";

vi.mock("../api/gitApi", () => ({ gitApi: { getStatus: vi.fn(), getDiff: vi.fn() } }));
vi.mock("../api/healthApi", () => ({ healthApi: { check: vi.fn() } }));
vi.mock("../lib/providers", async importOriginal => ({
  ...(await importOriginal<typeof import("../lib/providers")>()),
  getProviderStatuses: vi.fn().mockResolvedValue({ codex: { installed: true, authenticated: true }, gemini: { installed: false, authenticated: false } }),
}));

const repository: RepositoryInfo = { id: 3, name: "sample", root_path: "/sample", current_branch: "main", head_commit: "abcdef1234567", opened_at: new Date(Date.now() - 120_000).toISOString(), file_count: 42 };
const tree: TreeNode = { name: "sample", path: "", is_directory: true, file_id: null, language: null, size_bytes: null, children: [
  { name: "a.py", path: "a.py", is_directory: false, file_id: 1, language: "python", size_bytes: 10, children: [] },
  { name: "b.ts", path: "b.ts", is_directory: false, file_id: 2, language: "typescript", size_bytes: 10, children: [] },
  { name: "c.py", path: "c.py", is_directory: false, file_id: 3, language: "python", size_bytes: 10, children: [] },
] };
const status: GitStatus = {
  branch: "main", head_commit: "abcdef1234567", upstream: "origin/main", ahead: 1, behind: 0, remote_url: null,
  changes: [{ path: "a.py", index_status: "M", worktree_status: " ", original_path: null }, { path: "b.ts", index_status: " ", worktree_status: "M", original_path: null }],
  commits: [{ sha: "1111111aaaaaaa", message: "feat: live dashboard data", author: "Dev", committed_at: new Date(Date.now() - 7_200_000).toISOString() }],
};

beforeEach(() => {
  vi.mocked(gitApi.getStatus).mockResolvedValue(status);
  vi.mocked(healthApi.check).mockResolvedValue({ status: "ok" });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("DashboardPage", () => {
  it("shows live repository, Git, and backend state instead of placeholder activity", async () => {
    render(<DashboardPage repository={repository} tree={tree} isLoading={false} onNavigate={vi.fn()} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();

    expect(await screen.findByText("feat: live dashboard data")).toBeInTheDocument();
    expect(await screen.findByText("Operational")).toBeInTheDocument();
    expect(screen.getByText("tracking origin/main")).toBeInTheDocument();
    expect(screen.getByText("1 staged · 1 unstaged")).toBeInTheDocument();
    expect(screen.getByText("origin/main · 1 ahead, 0 behind")).toBeInTheDocument();
    expect(await screen.findByText("Connected")).toBeInTheDocument(); // provider status works in the browser build too
    expect(screen.getByText("Not installed")).toBeInTheDocument();
    expect(screen.queryByText("Production build passed")).not.toBeInTheDocument();
    expect(screen.queryByText("Tree-sitter Parser")).not.toBeInTheDocument();
  });

  it("reports an unreachable backend and a Git error honestly", async () => {
    vi.mocked(healthApi.check).mockRejectedValue(new Error("connect ECONNREFUSED"));
    vi.mocked(gitApi.getStatus).mockRejectedValue(new Error("'/sample' is not a Git repository"));
    render(<DashboardPage repository={repository} tree={tree} isLoading={false} onNavigate={vi.fn()} />);
    expect(await screen.findByText("Unreachable")).toBeInTheDocument();
    expect(await screen.findByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("is not a Git repository");
  });

  it("navigates through quick actions and re-indexes on request", async () => {
    const navigate = vi.fn();
    const reindex = vi.fn().mockResolvedValue(undefined);
    render(<DashboardPage repository={repository} tree={tree} isLoading={false} onNavigate={navigate} onReindex={reindex} />);
    fireEvent.click(screen.getByRole("button", { name: /Code Editor/ }));
    expect(navigate).toHaveBeenCalledWith("editor");
    fireEvent.click(screen.getByRole("button", { name: /Analytics/ }));
    expect(navigate).toHaveBeenCalledWith("analytics");
    fireEvent.click(screen.getByRole("button", { name: "Re-index" }));
    await waitFor(() => expect(reindex).toHaveBeenCalledTimes(1));
  });

  it("disables project-only actions and skips Git when nothing is open", () => {
    const navigate = vi.fn();
    render(<DashboardPage repository={null} tree={null} isLoading={false} onNavigate={navigate} />);
    expect(screen.getByRole("button", { name: /Terminal/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Git Repository/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Open a project" }));
    expect(navigate).toHaveBeenCalledWith("explorer");
    expect(gitApi.getStatus).not.toHaveBeenCalled();
    expect(screen.getByText("Open a project to see its commit history.")).toBeInTheDocument();
  });
});

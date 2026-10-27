import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitPage } from "./GitPage";
import { gitApi } from "../api/gitApi";
import type { GitStatus } from "../types/git";

vi.mock("../api/gitApi", () => ({ gitApi: { getStatus: vi.fn(), getDiff: vi.fn() } }));

const repository = { id: 1, name: "sample", root_path: "/sample", current_branch: "feature/original", head_commit: "123456789abcdef", opened_at: "2026-10-06T01:00:00Z", file_count: 12 };
const status: GitStatus = {
  branch: "feature/original",
  head_commit: "123456789abcdef",
  upstream: "origin/feature/original",
  ahead: 2,
  behind: 1,
  remote_url: "https://github.com/acme/sample",
  changes: [
    { path: "src/a.ts", index_status: " ", worktree_status: "M", original_path: null },
    { path: "b.ts", index_status: "A", worktree_status: " ", original_path: null },
  ],
  commits: [
    { sha: "abc1234def5678", message: "feat: real commit from git log", author: "Dev", committed_at: new Date(Date.now() - 3_600_000).toISOString() },
    { sha: "9876543210fedc", message: "chore: earlier work", author: "Dev", committed_at: new Date(Date.now() - 86_400_000).toISOString() },
  ],
};

beforeEach(() => { vi.mocked(gitApi.getStatus).mockResolvedValue(status); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("Git Repository page", () => {
  it("shows repository details, live branch state, and real commit history", async () => {
    render(<GitPage repository={repository} onNavigate={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Git Repository" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Repository Details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Branch & Commit" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Git Activity" })).toBeInTheDocument();
    expect(screen.getByText("/sample")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    expect(await screen.findByText("feat: real commit from git log")).toBeInTheDocument();
    expect(screen.getByText("chore: earlier work")).toBeInTheDocument();
    expect(screen.getByText("feature/original")).toBeInTheDocument();
    expect(screen.getByText("origin/feature/original")).toBeInTheDocument();
    expect(screen.getByText("2 ahead")).toBeInTheDocument();
    expect(screen.getByText("1 behind")).toBeInTheDocument();
    expect(screen.getByText("2 changed files")).toBeInTheDocument();
    expect(screen.getByText("1 staged · 1 unstaged")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy HEAD commit" })).toHaveTextContent("1234567");
    expect(screen.getByText("Latest 2 commits")).toBeInTheDocument();
    expect(gitApi.getStatus).toHaveBeenCalledWith(1);
  });

  it("keeps the connect action when no repository is selected and does not query Git", () => {
    const navigate = vi.fn();
    render(<GitPage repository={null} onNavigate={navigate} />);
    expect(screen.getByText("No Repository Connected")).toBeInTheDocument();
    expect(screen.queryByText("Repository Details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect Repository" }));
    expect(navigate).toHaveBeenCalledWith("explorer");
    expect(gitApi.getStatus).not.toHaveBeenCalled();
  });

  it("opens the repository's own remote, not a fixed project link", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<GitPage repository={repository} onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open remote" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://github.com/acme/sample", "_blank", "noopener,noreferrer"));
  });

  it("copies a commit hash and navigates to the editor to review changes", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const navigate = vi.fn();
    render(<GitPage repository={repository} onNavigate={navigate} />);
    fireEvent.click(await screen.findByRole("button", { name: "Copy commit abc1234" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("abc1234def5678"));
    fireEvent.click(screen.getByRole("button", { name: "Review changes in editor" }));
    expect(navigate).toHaveBeenCalledWith("editor");
  });

  it("prefers opening Source Control directly when the shell offers it", async () => {
    const onReviewChanges = vi.fn();
    const navigate = vi.fn();
    render(<GitPage repository={repository} onNavigate={navigate} onReviewChanges={onReviewChanges} />);
    fireEvent.click(await screen.findByRole("button", { name: "Review changes in editor" }));
    expect(onReviewChanges).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("reports Git errors with a retry action", async () => {
    vi.mocked(gitApi.getStatus).mockRejectedValueOnce(new Error("'/sample' is not a Git repository"));
    render(<GitPage repository={repository} onNavigate={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("is not a Git repository");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(gitApi.getStatus).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("feat: real commit from git log")).toBeInTheDocument();
  });
});

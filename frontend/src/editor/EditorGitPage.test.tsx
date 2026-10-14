import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { gitApi } from "../api/gitApi";
import type { GitDiff, GitStatus } from "../types/git";
import { EditorGitPage } from "./EditorGitPage";
import { parseGitDiff, splitGitDiff } from "./gitDiff";

vi.mock("../api/gitApi", () => ({ gitApi: { getStatus: vi.fn(), getDiff: vi.fn() } }));
const repository = { id: 1, name: "project", root_path: "/project", current_branch: "santi", head_commit: "abc1234", opened_at: null, file_count: 4 };
const status: GitStatus = {
  branch: "santi", head_commit: "abc1234", upstream: "origin/santi", ahead: 2, behind: 0, remote_url: null,
  changes: [
    { path: "src/main.ts", index_status: "M", worktree_status: "M", original_path: null },
    { path: "README.md", index_status: "?", worktree_status: "?", original_path: null },
    { path: "merge.ts", index_status: "U", worktree_status: "U", original_path: null },
  ],
  commits: [{ sha: "abc1234", message: "Preserve folder scope", author: "KSK", committed_at: "2026-10-07T01:00:00Z" }],
};
const patch = (text = "new", staged = false): GitDiff => ({ path: "src/main.ts", staged, is_binary: false, truncated: false, content: `diff --git a/src/main.ts b/src/main.ts\n--- a/src/main.ts\n+++ b/src/main.ts\n@@ -10,2 +20,2 @@\n-old\n+${text}\n context\n` });
const props = { repository, active: true, onReturn: vi.fn(), onOpenFolder: vi.fn() };
beforeEach(() => { vi.mocked(gitApi.getStatus).mockResolvedValue(status); vi.mocked(gitApi.getDiff).mockResolvedValue(patch()); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("reviews staged and working-tree versions separately, with conflicts in their own group", async () => {
  render(<EditorGitPage {...props} />);
  expect(await screen.findByText("3 changed files")).toBeVisible();
  expect(screen.getByText("origin/santi")).toBeVisible();
  expect(screen.getAllByText("Preserve folder scope").length).toBe(2);
  expect(screen.getByRole("button", { name: "Merge Changes: merge.ts" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Changes: merge.ts" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Staged Changes: src/main.ts" }));
  expect(await screen.findByRole("region", { name: "File diff" })).toBeVisible();
  expect(gitApi.getDiff).toHaveBeenLastCalledWith(1, "src/main.ts", true);
  expect(screen.getByText("HEAD → Index")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Changes: src/main.ts" }));
  await screen.findByRole("region", { name: "File diff" });
  expect(gitApi.getDiff).toHaveBeenLastCalledWith(1, "src/main.ts", false);
  fireEvent.click(screen.getByRole("button", { name: "Unified diff" }));
  const region = screen.getByRole("region", { name: "File diff" });
  expect(within(region).getByText("old")).toBeVisible();
  expect(within(region).getByText("new")).toBeVisible();
  expect(screen.getByRole("button", { name: "Unified diff" })).toHaveAttribute("aria-pressed", "true");
});

it("ignores a stale diff response after selecting another change", async () => {
  let finish!: (value: GitDiff) => void;
  vi.mocked(gitApi.getDiff).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(patch("current change"));
  render(<EditorGitPage {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Staged Changes: src/main.ts" }));
  fireEvent.click(screen.getByRole("button", { name: "Changes: src/main.ts" }));
  expect(await screen.findByText("current change")).toBeVisible();
  await act(async () => { finish(patch("stale staged change", true)); });
  expect(screen.queryByText("stale staged change")).toBeNull();
  expect(screen.getByText("current change")).toBeVisible();
});

it("refreshes status and returns to the overview when the selected change is gone", async () => {
  render(<EditorGitPage {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Changes: src/main.ts" }));
  await screen.findByRole("region", { name: "File diff" });
  vi.mocked(gitApi.getStatus).mockResolvedValue({ ...status, changes: [] });
  fireEvent.click(screen.getByRole("button", { name: "Refresh Git status" }));
  expect((await screen.findAllByText("Working tree clean"))[0]).toBeVisible();
  expect(screen.queryByRole("region", { name: "File diff" })).toBeNull();
});

it("shows a non-Git folder error and can retry after recovery", async () => {
  vi.mocked(gitApi.getStatus).mockRejectedValueOnce(new Error("Folder is not a Git repository."));
  render(<EditorGitPage {...props} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Folder is not a Git repository.");
  expect(screen.getByText("Git is unavailable for this folder")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("3 changed files")).toBeVisible();
});

it("never displays the previous project's status when responses arrive out of order", async () => {
  let finish!: (value: GitStatus) => void;
  vi.mocked(gitApi.getStatus).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ ...status, branch: "next-branch", changes: [] });
  const view = render(<EditorGitPage {...props} />);
  view.rerender(<EditorGitPage {...props} repository={{ ...repository, id: 2, name: "next", root_path: "/next" }} />);
  await screen.findAllByText("Working tree clean");
  await act(async () => { finish(status); });
  expect(screen.queryByText("3 changed files")).toBeNull();
  expect(screen.queryByRole("button", { name: "Changes: src/main.ts" })).toBeNull();
  expect(screen.getAllByText("next-branch").length).toBeGreaterThan(0);
});

it("handles binary changes and retries a failed diff", async () => {
  vi.mocked(gitApi.getDiff).mockRejectedValueOnce(new Error("Could not read this file.")).mockResolvedValue({ ...patch(), is_binary: true, content: "" });
  render(<EditorGitPage {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Changes: README.md" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not read this file.");
  fireEvent.click(screen.getByRole("button", { name: "Retry diff" }));
  expect(await screen.findByText("Binary file")).toBeVisible();
});

it("preserves hunk line numbers and pairs changed lines without counting file headers", () => {
  const lines = parseGitDiff(patch().content);
  expect(lines.filter(line => line.kind === "added")).toEqual([{ kind: "added", oldLine: null, newLine: 20, text: "new" }]);
  expect(lines.find(line => line.kind === "context")).toEqual({ kind: "context", oldLine: 11, newLine: 21, text: "context" });
  const changedRow = splitGitDiff(lines).find(row => row.left?.kind === "removed");
  expect(changedRow?.left?.oldLine).toBe(10);
  expect(changedRow?.right?.newLine).toBe(20);
  const merge = parseGitDiff("diff --cc merge.ts\n@@@ -1,1 -1,1 +1,1 @@@\n++<<<<<<< HEAD\n");
  expect(merge.at(-1)).toEqual({ kind: "meta", oldLine: null, newLine: null, text: "++<<<<<<< HEAD" });
});

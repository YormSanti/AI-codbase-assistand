import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { gitApi } from "../api/gitApi";
import type { GitDiff, GitStatus } from "../types/git";
import { EditorGitPage } from "./EditorGitPage";
import { ConfirmProvider } from "../components/ConfirmDialog";
import { FILES_CHANGED_EVENT } from "../lib/fileEvents";
import { parseGitDiff, splitGitDiff } from "./gitDiff";

vi.mock("../api/gitApi", () => ({ gitApi: { getStatus: vi.fn(), getDiff: vi.fn(), getStagedDiff: vi.fn(), getCommit: vi.fn(), getCommitDiff: vi.fn(), stage: vi.fn(), unstage: vi.fn(), discard: vi.fn(), commit: vi.fn() } }));
const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));
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
afterEach(() => { cleanup(); vi.resetAllMocks(); Reflect.deleteProperty(window, "__TAURI_INTERNALS__"); localStorage.clear(); });

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

it("stages, unstages, and commits from the sidebar using the returned status", async () => {
  const afterStage: GitStatus = { ...status, changes: status.changes.map(change => change.path === "README.md" ? { ...change, index_status: "A", worktree_status: " " } : change) };
  const afterUnstage: GitStatus = { ...afterStage, changes: afterStage.changes.map(change => change.path === "src/main.ts" ? { ...change, index_status: " " } : change) };
  const afterCommit: GitStatus = { ...status, head_commit: "def5678abcdef", changes: [status.changes[2]], commits: [{ sha: "def5678abcdef", message: "feat: stage from UI", author: "KSK", committed_at: "2026-10-26T01:00:00Z" }, ...status.commits] };
  vi.mocked(gitApi.stage).mockResolvedValue(afterStage);
  vi.mocked(gitApi.unstage).mockResolvedValue(afterUnstage);
  vi.mocked(gitApi.commit).mockResolvedValue(afterCommit);
  render(<EditorGitPage {...props} />);
  await screen.findByText("3 changed files");
  expect(screen.getByRole("button", { name: /^Commit/ })).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Stage README.md" }));
  expect(gitApi.stage).toHaveBeenCalledWith(1, ["README.md"]);
  expect(await screen.findByRole("button", { name: "Staged Changes: README.md" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Changes: README.md" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Unstage src/main.ts" }));
  expect(gitApi.unstage).toHaveBeenCalledWith(1, ["src/main.ts"]);
  expect(await screen.findByRole("button", { name: "Changes: src/main.ts" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Staged Changes: src/main.ts" })).toBeNull();

  const message = screen.getByRole("textbox", { name: "Commit message" });
  fireEvent.change(message, { target: { value: "feat: stage from UI" } });
  expect(screen.getByRole("button", { name: "Commit (1)" })).toBeEnabled();
  fireEvent.keyDown(message, { key: "Enter", ctrlKey: true });
  expect(gitApi.commit).toHaveBeenCalledWith(1, "feat: stage from UI");
  expect((await screen.findAllByText("feat: stage from UI")).length).toBeGreaterThan(0);
  expect(message).toHaveValue("");
  expect(screen.getByText("1 changed file")).toBeVisible();
});

it("stages a whole group and shows Git's error when an action is rejected", async () => {
  vi.mocked(gitApi.stage).mockRejectedValueOnce(new Error("'README.md' is no longer changed. Refresh the Git status."));
  render(<EditorGitPage {...props} />);
  await screen.findByText("3 changed files");
  fireEvent.click(screen.getByRole("button", { name: "Stage all changes" }));
  expect(gitApi.stage).toHaveBeenCalledWith(1, ["src/main.ts", "README.md"]);
  expect(await screen.findByRole("alert")).toHaveTextContent("no longer changed");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Unstage all changes" }));
  expect(gitApi.unstage).toHaveBeenCalledWith(1, ["src/main.ts"]);
});

it("drafts an AI review of the selected diff with its scope", async () => {
  const onAskAI = vi.fn();
  render(<EditorGitPage {...props} onAskAI={onAskAI} />);
  fireEvent.click(await screen.findByRole("button", { name: "Staged Changes: src/main.ts" }));
  await screen.findByRole("region", { name: "File diff" });
  fireEvent.click(screen.getByRole("button", { name: "Review with AI" }));
  const prompt = onAskAI.mock.calls[0][0] as string;
  expect(prompt).toContain("Review the staged changes to `src/main.ts`");
  expect(prompt).toContain("```diff\ndiff --git a/src/main.ts b/src/main.ts");
  expect(prompt).toContain("+new");
});

it("hides the AI review without a handler and disables it for binary diffs", async () => {
  const view = render(<EditorGitPage {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Changes: src/main.ts" }));
  await screen.findByRole("region", { name: "File diff" });
  expect(screen.queryByRole("button", { name: "Review with AI" })).toBeNull();
  view.unmount();
  vi.mocked(gitApi.getDiff).mockResolvedValue({ ...patch(), is_binary: true, content: "" });
  render(<EditorGitPage {...props} onAskAI={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Changes: README.md" }));
  expect(await screen.findByText("Binary file")).toBeVisible();
  expect(screen.getByRole("button", { name: "Review with AI" })).toBeDisabled();
});

const stagedDiff = { content: "diff --git a/src/main.ts b/src/main.ts\n@@ -1 +1 @@\n-old\n+new\n", stat: " src/main.ts | 2 +-\n 1 file changed", files: 1, truncated: false };

it("writes a commit message for the staged changes with the default provider", async () => {
  Object.assign(window, { __TAURI_INTERNALS__: {} });
  vi.mocked(gitApi.getStagedDiff).mockResolvedValue(stagedDiff);
  tauri.invoke.mockResolvedValue({ content: "```\nfix(main): replace old value\n\nKeeps the new behaviour.\n```" });
  render(<EditorGitPage {...props} />);
  await screen.findByText("3 changed files");
  fireEvent.click(screen.getByRole("button", { name: "Generate commit message with AI" }));
  const message = screen.getByRole("textbox", { name: "Commit message" });
  await waitFor(() => expect(message).toHaveValue("fix(main): replace old value\n\nKeeps the new behaviour."));
  const request = tauri.invoke.mock.calls.find(([command]) => command === "run_agent")![1].request;
  expect(request.provider).toBe("gemini");
  expect(request.workingDirectory).toBe("/project");
  expect(request.prompt).toContain("- Preserve folder scope");
  expect(request.prompt).toContain("+new");
  expect(screen.getByRole("button", { name: "Commit (1)" })).toBeEnabled();
});

it("explains why message generation is unavailable in the browser and reports provider errors", async () => {
  vi.mocked(gitApi.getStagedDiff).mockResolvedValue(stagedDiff);
  const view = render(<EditorGitPage {...props} />);
  await screen.findByText("3 changed files");
  const generate = screen.getByRole("button", { name: "Generate commit message with AI" });
  expect(generate).toBeDisabled();
  expect(generate).toHaveAttribute("title", "Generating commit messages needs the desktop app");
  view.unmount();

  Object.assign(window, { __TAURI_INTERNALS__: {} });
  tauri.invoke.mockRejectedValue(new Error("Gemini CLI was not found. Connect or install Gemini first."));
  render(<EditorGitPage {...props} />);
  await screen.findByText("3 changed files");
  fireEvent.click(screen.getByRole("button", { name: "Generate commit message with AI" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Gemini CLI was not found");
  expect(screen.getByRole("textbox", { name: "Commit message" })).toHaveValue("");
});

it("drafts an AI review of everything staged", async () => {
  vi.mocked(gitApi.getStagedDiff).mockResolvedValue(stagedDiff);
  const onAskAI = vi.fn();
  render(<EditorGitPage {...props} onAskAI={onAskAI} />);
  await screen.findByText("3 changed files");
  fireEvent.click(screen.getByRole("button", { name: "Review staged changes with AI" }));
  await waitFor(() => expect(onAskAI).toHaveBeenCalledTimes(1));
  expect(onAskAI.mock.calls[0][0]).toContain("Review the staged changes below before I commit them.");
  expect(onAskAI.mock.calls[0][0]).toContain(" src/main.ts | 2 +-");
});

const commitDetails = {
  sha: "abc1234", message: "Preserve folder scope\n\nKeep the opened folder as the root.", author: "KSK", author_email: "ksk@example.com",
  committed_at: "2026-10-07T01:00:00Z", parents: ["0f0f0f0f0f"],
  files: [
    { path: "src/main.ts", status: "M", original_path: null, additions: 1, deletions: 1 },
    { path: "docs/new.md", status: "R", original_path: "docs/old.md", additions: 0, deletions: 0 },
    { path: "logo.png", status: "A", original_path: null, additions: null, deletions: null },
  ],
};

it("opens a commit from history with its message, files, and per-file diffs", async () => {
  vi.mocked(gitApi.getCommit).mockResolvedValue(commitDetails);
  vi.mocked(gitApi.getCommitDiff).mockImplementation(async (_id, _sha, path) => path === "logo.png"
    ? { path, staged: false, is_binary: true, truncated: false, content: "Binary files /dev/null and b/logo.png differ\n" }
    : { ...patch("committed change"), path });
  const onAskAI = vi.fn();
  render(<EditorGitPage {...props} onAskAI={onAskAI} />);
  fireEvent.click(await screen.findByRole("button", { name: "Open commit abc1234: Preserve folder scope" }));
  expect(gitApi.getCommit).toHaveBeenCalledWith(1, "abc1234");
  expect(await screen.findByText("Keep the opened folder as the root.")).toBeVisible();
  expect(screen.getByText("Parent 0f0f0f0")).toBeVisible();
  expect(screen.getByText("3 files changed")).toBeVisible();
  expect(await screen.findByText("committed change")).toBeVisible();
  expect(gitApi.getCommitDiff).toHaveBeenLastCalledWith(1, "abc1234", "src/main.ts");
  expect(screen.getByRole("button", { name: "Modified: src/main.ts" })).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(screen.getByRole("button", { name: "Review with AI" }));
  expect(onAskAI.mock.calls[0][0]).toContain("Review the commit abc1234 changes to `src/main.ts`");

  fireEvent.click(screen.getByRole("button", { name: "Added: logo.png" }));
  expect(await screen.findByText("Binary file")).toBeVisible();
  expect(gitApi.getCommitDiff).toHaveBeenLastCalledWith(1, "abc1234", "logo.png");

  fireEvent.click(screen.getByRole("button", { name: "Repository overview" }));
  expect(await screen.findByText("3 changed files")).toBeVisible();
  expect(screen.queryByRole("list", { name: "Files changed in this commit" })).toBeNull();
});

it("leaves the commit view when a working-tree change is selected and reports commit errors", async () => {
  vi.mocked(gitApi.getCommit).mockRejectedValueOnce(new Error("That commit is not in this repository."));
  render(<EditorGitPage {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Open commit abc1234: Preserve folder scope" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("That commit is not in this repository.");
  fireEvent.click(screen.getByRole("button", { name: "Changes: src/main.ts" }));
  expect(await screen.findByRole("region", { name: "File diff" })).toBeVisible();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("discards a file only after confirming in the app dialog and announces the rewritten file", async () => {
  vi.mocked(gitApi.discard).mockResolvedValue({ ...status, changes: status.changes.filter(change => change.path !== "README.md") });
  const announced = vi.fn();
  window.addEventListener(FILES_CHANGED_EVENT, announced);
  render(<ConfirmProvider><EditorGitPage {...props} /></ConfirmProvider>);
  await screen.findByText("3 changed files");

  fireEvent.click(screen.getByRole("button", { name: "Discard README.md" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Delete README.md?" });
  expect(dialog).toHaveTextContent("README.md is untracked, so it will be deleted from disk.");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(gitApi.discard).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Discard src/main.ts" }));
  await screen.findByRole("alertdialog", { name: "Discard changes in main.ts?" });
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  await waitFor(() => expect(gitApi.discard).toHaveBeenCalledWith(1, ["src/main.ts"]));
  await waitFor(() => expect(announced).toHaveBeenCalledTimes(1));
  expect((announced.mock.calls[0][0] as CustomEvent).detail).toEqual({ paths: ["src/main.ts"] });
  window.removeEventListener(FILES_CHANGED_EVENT, announced);
});

it("discards a whole group with one confirmation that counts untracked files", async () => {
  vi.mocked(gitApi.discard).mockResolvedValue({ ...status, changes: [status.changes[2]] });
  render(<ConfirmProvider><EditorGitPage {...props} /></ConfirmProvider>);
  await screen.findByText("3 changed files");
  fireEvent.click(screen.getByRole("button", { name: "Discard all changes" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Discard 2 changes?" });
  expect(dialog).toHaveTextContent("1 untracked file will be deleted");
  fireEvent.click(screen.getByRole("button", { name: "Discard all" }));
  await waitFor(() => expect(gitApi.discard).toHaveBeenCalledWith(1, ["src/main.ts", "README.md"]));
  expect(screen.queryByRole("button", { name: "Discard merge.ts" })).toBeNull(); // conflicts are never discarded
});

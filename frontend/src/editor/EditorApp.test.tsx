import { useEffect, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RepositoryInfo } from "../types/domain";
import { EditorApp } from "./EditorApp";
import { gitApi } from "../api/gitApi";

const shells = vi.hoisted(() => ({ start: vi.fn(), close: vi.fn() }));
vi.mock("../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../api/editorApi", () => ({ editorApi: { search: vi.fn().mockResolvedValue({ query: "draft", matches: [{ path: "src/a.ts", line: 3, column: 1, text: "draft line" }], files_scanned: 1, truncated: false }) } }));
vi.mock("../api/gitApi", () => ({ gitApi: { getStatus: vi.fn().mockResolvedValue({ branch: "main", changes: [], commits: [], head_commit: null, upstream: null, ahead: null, behind: null, remote_url: null }), getDiff: vi.fn() } }));
vi.mock("../components/TerminalPage", () => ({ TerminalPage: ({ repository }: { repository: RepositoryInfo }) => {
  const [command, setCommand] = useState("");
  useEffect(() => { shells.start(repository.root_path); return () => { shells.close(repository.root_path); }; }, [repository.root_path]);
  return <input aria-label="Shell input" value={command} onChange={event => setCommand(event.target.value)} />;
} }));

const repository: RepositoryInfo = { id: 1, name: "project", root_path: "/project", current_branch: "main", head_commit: null, opened_at: null, file_count: 1 };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("keeps the file draft and shell when entering and leaving the editor through File Explorer", async () => {
  const props = { active: false, repository, isLoading: false, onNavigate: vi.fn() };
  const view = render(<EditorApp {...props}><input aria-label="File draft" defaultValue="saved" /></EditorApp>);
  fireEvent.change(screen.getByLabelText("File draft"), { target: { value: "unsaved draft" } });
  view.rerender(<EditorApp {...props} active><input aria-label="File draft" defaultValue="saved" /></EditorApp>);
  expect(screen.getByLabelText("File draft")).toHaveValue("unsaved draft");
  expect(shells.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Toggle integrated terminal" }));
  fireEvent.change(await screen.findByLabelText("Shell input", {}, { timeout: 5000 }), { target: { value: "npm run dev" } });
  view.rerender(<EditorApp {...props}><input aria-label="File draft" defaultValue="saved" /></EditorApp>);
  expect(screen.getByLabelText("File draft")).toHaveValue("unsaved draft");
  expect(screen.getByLabelText("Shell input")).not.toBeVisible();
  expect(shells.close).not.toHaveBeenCalled();
  view.rerender(<EditorApp {...props} active><input aria-label="File draft" defaultValue="saved" /></EditorApp>);
  expect(screen.getByLabelText("Shell input")).toHaveValue("npm run dev");
  expect(shells.start).toHaveBeenCalledTimes(1);
});

it("switches a visible terminal to the new project and defers a hidden terminal until requested", async () => {
  const props = { active: true, repository, isLoading: false, onNavigate: vi.fn() };
  const next = { ...repository, id: 2, name: "next", root_path: "/next" };
  const third = { ...repository, id: 3, name: "third", root_path: "/third" };
  const view = render(<EditorApp {...props}><span>workspace</span></EditorApp>);
  fireEvent.click(screen.getByRole("button", { name: "Toggle integrated terminal" }));
  await waitFor(() => expect(shells.start).toHaveBeenCalledWith("/project"), { timeout: 5000 });
  view.rerender(<EditorApp {...props} repository={next}><span>workspace</span></EditorApp>);
  expect(shells.close).toHaveBeenCalledWith("/project");
  expect(shells.start).toHaveBeenLastCalledWith("/next");
  fireEvent.click(screen.getByRole("button", { name: "Hide integrated terminal" }));
  view.rerender(<EditorApp {...props} repository={third}><span>workspace</span></EditorApp>);
  expect(shells.close).toHaveBeenCalledWith("/next");
  expect(shells.start).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Toggle integrated terminal" }));
  expect(shells.start).toHaveBeenLastCalledWith("/third");
});

it("keeps drafts and the terminal alive while reviewing Git inside the editor", async () => {
  const onNavigate = vi.fn();
  render(<EditorApp active repository={repository} isLoading={false} onNavigate={onNavigate}>
    {visible => <input aria-label="File draft" defaultValue="saved" data-active={visible} />}
  </EditorApp>);
  fireEvent.change(screen.getByLabelText("File draft"), { target: { value: "unsaved" } });
  fireEvent.click(screen.getByRole("button", { name: "Toggle integrated terminal" }));
  fireEvent.change(await screen.findByLabelText("Shell input", {}, { timeout: 5000 }), { target: { value: "git status" } });
  fireEvent.click(screen.getByRole("button", { name: "Git Repository" }));
  expect((await screen.findAllByText("Working tree clean", {}, { timeout: 5000 }))[0]).toBeVisible();
  expect(screen.getByLabelText("File draft")).not.toBeVisible();
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "false");
  expect(screen.getByLabelText("Shell input")).toHaveValue("git status");
  expect(shells.close).not.toHaveBeenCalled();
  expect(onNavigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Back to code" }));
  expect(screen.getByLabelText("File draft")).toBeVisible();
  expect(screen.getByLabelText("File draft")).toHaveValue("unsaved");
  expect(shells.start).toHaveBeenCalledTimes(1);
});

it("opens AI assistant inside the editor without navigating away from code", async () => {
  const onNavigate = vi.fn();
  render(<EditorApp active repository={repository} isLoading={false} onNavigate={onNavigate}>
    {visible => <input aria-label="File draft" defaultValue="saved" data-active={visible} />}
  </EditorApp>);
  fireEvent.change(screen.getByLabelText("File draft"), { target: { value: "my code draft" } });
  fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));

  // Does not navigate back to IFROG
  expect(onNavigate).not.toHaveBeenCalled();

  // The draft is hidden while AI assistant is visible
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "false");
  expect(screen.getAllByText("AI Assistant").length).toBeGreaterThan(0);

  // Clicking "Back to code" returns to code
  fireEvent.click(screen.getByRole("button", { name: "Back to code" }));
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "true");
  expect(screen.getByLabelText("File draft")).toHaveValue("my code draft");
});

it("opens extensions inside the editor without navigating away from code", async () => {
  const onNavigate = vi.fn();
  render(<EditorApp active repository={repository} isLoading={false} onNavigate={onNavigate}>
    {visible => <input aria-label="File draft" defaultValue="saved" data-active={visible} />}
  </EditorApp>);
  fireEvent.change(screen.getByLabelText("File draft"), { target: { value: "extensions test draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Extensions" }));

  // Does not navigate back to IFROG
  expect(onNavigate).not.toHaveBeenCalled();

  // The draft is hidden while extensions view is visible
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "false");
  expect(await screen.findByText("Install from VSIX…", {}, { timeout: 5000 })).toBeVisible();
  expect(screen.getByText("Python")).toBeVisible();

  // Clicking "Back to code" returns to code
  fireEvent.click(screen.getByRole("button", { name: "Back to code" }));
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "true");
  expect(screen.getByLabelText("File draft")).toHaveValue("extensions test draft");
});

it("keeps the open file code visible and active when closing or toggling the explorer sidebar", () => {
  const onCommand = vi.fn();
  render(<EditorApp active repository={repository} isLoading={false} onNavigate={vi.fn()} onCommand={onCommand}>
    {visible => <input aria-label="File draft" defaultValue="active file code" data-active={visible} />}
  </EditorApp>);

  const explorerBtn = screen.getByRole("button", { name: "Explorer" });
  expect(explorerBtn).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("File draft")).toBeVisible();
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "true");

  // Click to close/toggle the explorer sidebar
  fireEvent.click(explorerBtn);
  expect(onCommand).toHaveBeenCalledWith("toggleExplorer");
  expect(explorerBtn).toHaveAttribute("aria-pressed", "false");

  // The open code file remains fully visible and active!
  expect(screen.getByLabelText("File draft")).toBeVisible();
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "true");
  expect(screen.getByLabelText("File draft")).toHaveValue("active file code");

  // Click to reopen explorer sidebar
  fireEvent.click(explorerBtn);
  expect(onCommand).toHaveBeenLastCalledWith("toggleExplorer");
  expect(explorerBtn).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("File draft")).toBeVisible();
});

it("opens dedicated editor settings inside the editor workspace without kicking user to global app settings", async () => {
  const onNavigate = vi.fn();
  render(
    <EditorApp active repository={repository} isLoading={false} onNavigate={onNavigate}>
      {visible => <input aria-label="File draft" defaultValue="in-flight code edits" data-active={visible} />}
    </EditorApp>
  );

  fireEvent.change(screen.getByLabelText("File draft"), { target: { value: "modified code buffer" } });

  // Click rail settings button
  const settingsBtn = screen.getByRole("button", { name: "Editor settings" });
  fireEvent.click(settingsBtn);

  // Crucial requirement: Must NOT kick out to global app settings page!
  expect(onNavigate).not.toHaveBeenCalled();

  // The draft is safely hidden in the background while settings is visible
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "false");
  expect(await screen.findByText("Editor Settings", {}, { timeout: 5000 })).toBeVisible();
  expect(screen.getByText("Editor: Font Size")).toBeVisible();
  expect(screen.getByText("Live Preview")).toBeVisible();

  // Clicking "Back to code" returns to code with the active buffer preserved
  fireEvent.click(screen.getByRole("button", { name: "Back to code" }));
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "true");
  expect(screen.getByLabelText("File draft")).toHaveValue("modified code buffer");
});

it("toggles editor settings with Ctrl+, shortcut without navigating away", async () => {
  const onNavigate = vi.fn();
  render(
    <EditorApp active repository={repository} isLoading={false} onNavigate={onNavigate}>
      {visible => <input aria-label="File draft" defaultValue="active code" data-active={visible} />}
    </EditorApp>
  );

  // Press Ctrl+,
  fireEvent.keyDown(window, { key: ",", ctrlKey: true });
  expect(onNavigate).not.toHaveBeenCalled();
  expect(await screen.findByText("Editor Settings", {}, { timeout: 5000 })).toBeVisible();

  // Press Ctrl+, again to toggle back
  fireEvent.keyDown(window, { key: ",", ctrlKey: true });
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "true");
});

it("searches project files from the rail and jumps to a match in the code view", async () => {
  const onRevealLine = vi.fn();
  render(<EditorApp active repository={repository} isLoading={false} onNavigate={vi.fn()} onRevealLine={onRevealLine}>
    {visible => <input aria-label="File draft" defaultValue="saved" data-active={visible} />}
  </EditorApp>);
  fireEvent.click(screen.getByRole("button", { name: "Search in files" }));
  const input = await screen.findByRole("searchbox", { name: "Search in files" }, { timeout: 5000 });
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "false");
  fireEvent.change(input, { target: { value: "draft" } });
  fireEvent.click(await screen.findByRole("button", { name: "src/a.ts line 3" }));
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "true");
  await waitFor(() => expect(onRevealLine).toHaveBeenCalledWith("src/a.ts", 3));
  fireEvent.keyDown(window, { key: "F", ctrlKey: true, shiftKey: true });
  expect(screen.getByRole("searchbox", { name: "Search in files" })).toBeVisible();
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "false");
  fireEvent.keyDown(window, { key: "F", ctrlKey: true, shiftKey: true });
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "true");
});

it("opens a requested tool view once it is active and reports it handled", async () => {
  const onRequestedViewHandled = vi.fn();
  const view = render(<EditorApp active={false} repository={repository} isLoading={false} onNavigate={vi.fn()} requestedView="search" onRequestedViewHandled={onRequestedViewHandled}>
    {visible => <input aria-label="File draft" defaultValue="saved" data-active={visible} />}
  </EditorApp>);
  expect(onRequestedViewHandled).not.toHaveBeenCalled();
  view.rerender(<EditorApp active repository={repository} isLoading={false} onNavigate={vi.fn()} requestedView="search" onRequestedViewHandled={onRequestedViewHandled}>
    {visible => <input aria-label="File draft" defaultValue="saved" data-active={visible} />}
  </EditorApp>);
  expect(await screen.findByRole("searchbox", { name: "Search in files" }, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "false");
  expect(onRequestedViewHandled).toHaveBeenCalledTimes(1);
});

it("hands a Source Control diff review to the AI Assistant as an editable draft", async () => {
  vi.mocked(gitApi.getStatus).mockResolvedValueOnce({ branch: "main", head_commit: "abc", upstream: null, ahead: null, behind: null, remote_url: null, commits: [],
    changes: [{ path: "src/a.ts", index_status: " ", worktree_status: "M", original_path: null }] });
  vi.mocked(gitApi.getDiff).mockResolvedValueOnce({ path: "src/a.ts", staged: false, is_binary: false, truncated: false, content: "diff --git a/src/a.ts b/src/a.ts\n@@ -1 +1 @@\n-old line\n+new line\n" });
  render(<EditorApp active repository={repository} isLoading={false} onNavigate={vi.fn()}>
    {visible => <input aria-label="File draft" defaultValue="saved" data-active={visible} />}
  </EditorApp>);
  fireEvent.click(screen.getByRole("button", { name: "Git Repository" }));
  fireEvent.click(await screen.findByRole("button", { name: "Changes: src/a.ts" }));
  await screen.findByRole("region", { name: "File diff" });
  fireEvent.click(screen.getByRole("button", { name: "Review with AI" }));
  const composer = await screen.findByRole("textbox", { name: "Message" });
  await waitFor(() => expect((composer as HTMLTextAreaElement).value).toContain("Review the working tree changes to `src/a.ts`"));
  expect((composer as HTMLTextAreaElement).value).toContain("+new line");
  expect(screen.getByRole("button", { name: "AI Assistant" })).toHaveAttribute("aria-pressed", "true");
});

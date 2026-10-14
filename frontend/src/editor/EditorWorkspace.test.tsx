import { useImperativeHandle, useState, type Ref } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExplorerPage } from "../components/ExplorerPage";
import type { CodeEditorHandle } from "../components/CodeEditorSurface";
import { fileApi } from "../api/fileApi";
import { editorApi } from "../api/editorApi";
import { ApiError } from "../api/client";
import type { FilePreview, RepositoryInfo, TreeNode } from "../types/domain";

const nativeWindow = vi.hoisted(() => ({ onCloseRequested: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => nativeWindow }));
vi.mock("../api/editorApi", () => ({ editorApi: { getTree: vi.fn(), getContent: vi.fn(), getSymbols: vi.fn(), saveContent: vi.fn() } }));
vi.mock("../api/fileApi", () => ({ fileApi: { getContent: vi.fn(), getSymbols: vi.fn(), saveContent: vi.fn() } }));
vi.mock("../components/CodeEditorSurface", () => ({ CodeEditorSurface: ({ ref, value, label, onChange, onSave, readOnly, active }: {
  ref: Ref<CodeEditorHandle>; value: string; label: string; onChange: (value: string) => void; onSave: () => void; readOnly: boolean; active: boolean;
}) => {
  useImperativeHandle(ref, () => ({ focus() {}, goToLine() {}, find() {}, showGoToLine() {}, undo() {}, redo() {}, selectAll() {} }));
  return <textarea aria-label={label} autoFocus={active} value={value} readOnly={readOnly} onChange={event => onChange(event.target.value)} onKeyDown={event => {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "s") { event.preventDefault(); onSave(); }
  }} />;
} }));

const repository: RepositoryInfo = { id: 4, name: "project", root_path: "/project", current_branch: "main", head_commit: null, opened_at: null, file_count: 1 };
const source: TreeNode = { name: "app.ts", path: "app.ts", is_directory: false, children: [], file_id: 8, language: "typescript", size_bytes: 20 };
const env: TreeNode = { ...source, name: ".env", path: ".env", file_id: -9, language: "other" };
const tree: TreeNode = { name: "project", path: "", is_directory: true, children: [source], file_id: null, language: null, size_bytes: null };
const preview = (file: TreeNode, content: string): FilePreview => ({ file_id: file.file_id!, path: file.path, content, is_binary: false, truncated: false, editable: true, content_hash: "a".repeat(64) });

function Workspace({ onStateChange = vi.fn() }: { onStateChange?: (state: { dirty: boolean; saving: boolean }) => void }) {
  const [selected, setSelected] = useState<TreeNode | null>(source);
  return <ExplorerPage mode="editor" repository={repository} tree={tree} selectedFile={selected} isLoading={false} onOpen={vi.fn()} onSelectFile={setSelected} onCloseFile={() => setSelected(null)} onAskAI={vi.fn()} onEditorStateChange={onStateChange} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(fileApi.getContent).mockResolvedValue(preview(source, "const saved = true;"));
  vi.mocked(fileApi.getSymbols).mockResolvedValue([]);
  vi.mocked(fileApi.saveContent).mockImplementation(async (_id, content) => preview(source, content));
  vi.mocked(editorApi.getTree).mockResolvedValue({ ...tree, children: [source, env] });
  vi.mocked(editorApi.getContent).mockResolvedValue(preview(env, "MODE=dev"));
  vi.mocked(editorApi.getSymbols).mockResolvedValue([]);
  vi.mocked(editorApi.saveContent).mockImplementation(async (_id, _path, content) => preview(env, content));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function editBoth() {
  fireEvent.change(await screen.findByRole("textbox", { name: "Edit app.ts" }), { target: { value: "const draft = true;" } });
  fireEvent.click(await screen.findByRole("treeitem", { name: ".env" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Edit .env" }), { target: { value: "MODE=test" } });
}

it("retains drafts across indexed and local tabs and saves all files with their original hashes", async () => {
  const onStateChange = vi.fn();
  const confirm = vi.spyOn(window, "confirm");
  render(<Workspace onStateChange={onStateChange} />);
  await editBoth();
  expect(screen.getByText("2 unsaved")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "app.ts" }));
  expect(screen.getByRole("textbox", { name: "Edit app.ts" })).toHaveValue("const draft = true;");
  expect(fileApi.getContent).toHaveBeenCalledTimes(1);
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Edit app.ts" }), { key: "S", ctrlKey: true, shiftKey: true });
  await screen.findByText("Saved 2 files.");
  expect(fileApi.saveContent).toHaveBeenCalledWith(8, "const draft = true;", "a".repeat(64));
  expect(editorApi.saveContent).toHaveBeenCalledWith(4, ".env", "MODE=test", "a".repeat(64));
  expect(onStateChange).toHaveBeenLastCalledWith({ dirty: false, saving: false });
  await waitFor(() => expect(screen.queryByText("2 unsaved")).not.toBeInTheDocument());
});

it("keeps a failed draft, saves the other tab, and selects the conflicting file", async () => {
  vi.mocked(editorApi.saveContent).mockRejectedValueOnce(new ApiError(409, "The file changed on disk."));
  const onStateChange = vi.fn();
  render(<Workspace onStateChange={onStateChange} />);
  await editBoth();
  fireEvent.click(screen.getByRole("tab", { name: "app.ts" }));
  fireEvent.click(screen.getByRole("button", { name: "Save all files" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("The file changed on disk.");
  expect(screen.getByRole("textbox", { name: "Edit .env" })).toHaveValue("MODE=test");
  expect(screen.getByText("Could not save .env. Your drafts are kept.")).toBeInTheDocument();
  expect(await screen.findByText("1 unsaved")).toBeInTheDocument();
  expect(onStateChange).toHaveBeenLastCalledWith({ dirty: true, saving: false });
  expect(fileApi.saveContent).toHaveBeenCalledTimes(1);
});

it("guards closing an inactive dirty tab and switches to a neighbor when the active tab closes", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const onStateChange = vi.fn();
  render(<Workspace onStateChange={onStateChange} />);
  fireEvent.change(await screen.findByRole("textbox", { name: "Edit app.ts" }), { target: { value: "unsaved" } });
  fireEvent.click(await screen.findByRole("treeitem", { name: ".env" }));
  await screen.findByRole("textbox", { name: "Edit .env" });
  const beforeUnload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(beforeUnload);
  expect(beforeUnload.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Close app.ts" }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("tab", { name: "app.ts" })).toBeInTheDocument();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Close app.ts" }));
  expect(screen.queryByRole("tab", { name: "app.ts" })).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Edit .env" })).toHaveValue("MODE=dev");
  expect(onStateChange).toHaveBeenLastCalledWith({ dirty: false, saving: false });
  fireEvent.click(screen.getByRole("treeitem", { name: "app.ts" }));
  await screen.findByRole("textbox", { name: "Edit app.ts" });
  fireEvent.click(screen.getByRole("button", { name: "Close app.ts" }));
  expect(screen.getByRole("tab", { name: ".env" })).toHaveAttribute("aria-selected", "true");
});

it("keeps a hidden saving tab mounted and blocks closing it until the save completes", async () => {
  let finish!: (preview: FilePreview) => void;
  vi.mocked(fileApi.saveContent).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const onStateChange = vi.fn();
  render(<Workspace onStateChange={onStateChange} />);
  const editor = await screen.findByRole("textbox", { name: "Edit app.ts" });
  fireEvent.change(editor, { target: { value: "saving draft" } });
  fireEvent.keyDown(editor, { key: "s", ctrlKey: true });
  fireEvent.click(await screen.findByRole("treeitem", { name: ".env" }));
  await screen.findByRole("textbox", { name: "Edit .env" });
  expect(screen.getByRole("button", { name: "Close app.ts" })).toBeDisabled();
  expect(onStateChange).toHaveBeenLastCalledWith({ dirty: true, saving: true });
  await act(async () => finish(preview(source, "saving draft")));
  expect(screen.getByRole("button", { name: "Close app.ts" })).toBeEnabled();
  expect(onStateChange).toHaveBeenLastCalledWith({ dirty: false, saving: false });
});

it("registers one native close guard for the whole workspace and protects hidden drafts", async () => {
  vi.stubGlobal("__TAURI_INTERNALS__", {});
  const unlisten = vi.fn();
  nativeWindow.onCloseRequested.mockResolvedValue(unlisten);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const view = render(<Workspace />);
  await editBoth();
  await waitFor(() => expect(nativeWindow.onCloseRequested).toHaveBeenCalledTimes(1));
  const event = { preventDefault: vi.fn() };
  nativeWindow.onCloseRequested.mock.calls[0][0](event);
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(event.preventDefault).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(unlisten).toHaveBeenCalledTimes(1);
});

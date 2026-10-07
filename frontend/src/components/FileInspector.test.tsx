import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileApi } from "../api/fileApi";
import { editorApi } from "../api/editorApi";
import { ApiError } from "../api/client";
import type { TreeNode } from "../types/domain";
import { FileInspector } from "./FileInspector";

const nativeWindow = vi.hoisted(() => ({ onCloseRequested: vi.fn() }));
vi.mock("../api/editorApi", () => ({ editorApi: { getContent: vi.fn(), getSymbols: vi.fn(), saveContent: vi.fn() } }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => nativeWindow }));

vi.mock("./CodeEditorSurface", () => ({ CodeEditorSurface: ({ value, label, onChange, onSave, readOnly }: {
  value: string; label: string; onChange: (value: string) => void; onSave: () => void; readOnly: boolean;
}) => <textarea aria-label={label} value={value} readOnly={readOnly} onChange={event => onChange(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "s") { event.preventDefault(); onSave(); } }} /> }));

vi.mock("../api/fileApi", () => ({
  fileApi: {
    getContent: vi.fn(),
    getSymbols: vi.fn(),
    saveContent: vi.fn(),
  },
}));

const file: TreeNode = {
  name: "main.py",
  path: "src/main.py",
  is_directory: false,
  language: "python",
  size_bytes: 24,
  file_id: 7,
  children: [],
};

describe("FileInspector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(fileApi.getContent).mockResolvedValue({
      file_id: 7,
      path: "src/main.py",
      content: "def main():\n    pass",
      is_binary: false,
      truncated: false,
      content_hash: "a".repeat(64),
      editable: true,
    });
    vi.mocked(fileApi.getSymbols).mockResolvedValue([
      { id: 4, name: "main", kind: "function", parent_name: null, start_line: 1, end_line: 2 },
    ]);
    vi.mocked(fileApi.saveContent).mockImplementation(async (_id, content) => ({
      file_id: 7, path: "src/main.py", content, is_binary: false, truncated: false,
      content_hash: "b".repeat(64), size_bytes: content.length, editable: true,
    }));
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  async function editFile() {
    await screen.findByText("def main():");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    return screen.getByRole("textbox", { name: "Edit main.py" });
  }

  it("renders indexed source and its symbol outline", async () => {
    render(<FileInspector file={file} onClose={vi.fn()} />);

    expect(await screen.findByText("def main():")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("function · line 1")).toBeInTheDocument();
    expect(fileApi.getContent).toHaveBeenCalledWith(7);
    expect(fileApi.getSymbols).toHaveBeenCalledWith(7);
  });

  it("loads and saves an editor-only file by repository and path without touching the indexed API", async () => {
    const localFile = { ...file, name: '.env', path: '.env', language: 'other' as const, file_id: -17 };
    vi.mocked(editorApi.getContent).mockResolvedValue({ file_id: -17, path: '.env', content: 'MODE=dev', is_binary: false, truncated: false, content_hash: 'c'.repeat(64), editable: true });
    vi.mocked(editorApi.getSymbols).mockResolvedValue([]);
    vi.mocked(editorApi.saveContent).mockResolvedValue({ file_id: -17, path: '.env', content: 'MODE=test', is_binary: false, truncated: false, content_hash: 'd'.repeat(64), editable: true });
    render(<FileInspector file={localFile} localRepositoryId={3} onClose={vi.fn()} autoEdit />);
    const editor = await screen.findByRole('textbox', { name: 'Edit .env' });
    expect(editorApi.getContent).toHaveBeenCalledWith(3, '.env');
    fireEvent.change(editor, { target: { value: 'MODE=test' } });
    fireEvent.keyDown(editor, { key: 's', ctrlKey: true });
    await waitFor(() => expect(editorApi.saveContent).toHaveBeenCalledWith(3, '.env', 'MODE=test', 'c'.repeat(64)));
    await screen.findByText('Saved to disk.');
    expect(fileApi.getContent).not.toHaveBeenCalled();
    expect(fileApi.getSymbols).not.toHaveBeenCalled();
    expect(fileApi.saveContent).not.toHaveBeenCalled();
  });

  it("opens editable files in edit mode from Code Editor and discards back to saved content", async () => {
    render(<FileInspector file={file} onClose={vi.fn()} autoEdit />);
    const editor = await screen.findByRole("textbox", { name: "Edit main.py" });
    expect(editor).toHaveValue("def main():\n    pass");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(editor, { target: { value: "my edits" } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(editor).toHaveValue("def main():\n    pass");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(fileApi.saveContent).not.toHaveBeenCalled();
  });

  it("keeps a draft when switching between Explorer and Code Editor", async () => {
    const onClose = vi.fn();
    const view = render(<FileInspector file={file} onClose={onClose} />);
    const editor = await editFile();
    fireEvent.change(editor, { target: { value: "my unsaved draft" } });
    view.rerender(<FileInspector file={file} onClose={onClose} autoEdit />);
    expect(editor).toHaveValue("my unsaved draft");
    expect(fileApi.getContent).toHaveBeenCalledTimes(1);
    view.rerender(<FileInspector file={file} onClose={onClose} />);
    expect(editor).toHaveValue("my unsaved draft");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("saves edited code and refreshes the outline", async () => {
    const onSaved = vi.fn();
    const onEditorStateChange = vi.fn();
    render(<FileInspector file={file} onClose={vi.fn()} onSaved={onSaved} onEditorStateChange={onEditorStateChange} />);
    const editor = await editFile();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(editor, { target: { value: "def renamed():\n    return 1" } });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(onEditorStateChange).toHaveBeenLastCalledWith({ dirty: true, saving: false });
    vi.mocked(fileApi.getSymbols).mockResolvedValue([{ id: 5, name: "renamed", kind: "function", parent_name: null, start_line: 1, end_line: 2 }]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved to disk.");
    expect(fileApi.saveContent).toHaveBeenCalledWith(7, "def renamed():\n    return 1", "a".repeat(64));
    expect(screen.getByText("renamed")).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ file_id: 7, content_hash: "b".repeat(64) }));
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    // Further saves must use the version returned by the previous save.
    fireEvent.change(editor, { target: { value: "" } });
    fireEvent.keyDown(editor, { key: "s", ctrlKey: true });
    await waitFor(() => expect(fileApi.saveContent).toHaveBeenLastCalledWith(7, "", "b".repeat(64)));
  });

  it("retains edits and shows the reason when saving conflicts", async () => {
    vi.mocked(fileApi.saveContent).mockRejectedValue(new ApiError(409, "This file changed on disk."));
    render(<FileInspector file={file} onClose={vi.fn()} />);
    const editor = await editFile();
    fireEvent.change(editor, { target: { value: "my edits" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This file changed on disk.");
    expect(editor).toHaveValue("my edits");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("keeps drafts after network errors and distinguishes an outline refresh failure", async () => {
    vi.mocked(fileApi.saveContent).mockRejectedValueOnce(new Error("offline"));
    render(<FileInspector file={file} onClose={vi.fn()} />);
    const editor = await editFile();
    fireEvent.change(editor, { target: { value: "my edits" } });
    fireEvent.keyDown(editor, { key: "s", metaKey: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save this file.");
    expect(editor).toHaveValue("my edits");
    vi.mocked(fileApi.getSymbols).mockRejectedValueOnce(new Error("outline offline"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved to disk. Reopen the file to refresh its outline.");
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("requires confirmation to discard or close a dirty editor", async () => {
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<FileInspector file={file} onClose={onClose} />);
    const editor = await editFile();
    fireEvent.change(editor, { target: { value: "my edits" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(editor).toHaveValue("my edits");
    fireEvent.click(screen.getByTitle("Close file preview"));
    expect(onClose).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("textbox", { name: "Edit main.py" })).not.toBeInTheDocument();
    expect(screen.getByText("def main():")).toBeInTheDocument();
    expect(fileApi.saveContent).not.toHaveBeenCalled();
  });

  it("blocks duplicate saves and protects edits from reload while saving", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof fileApi.saveContent>>) => void;
    vi.mocked(fileApi.saveContent).mockReturnValue(new Promise(yes => { resolve = yes; }));
    render(<FileInspector file={file} onClose={vi.fn()} />);
    const editor = await editFile();
    fireEvent.change(editor, { target: { value: "my edits" } });
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    fireEvent.keyDown(editor, { key: "s", ctrlKey: true });
    fireEvent.keyDown(editor, { key: "s", ctrlKey: true });
    expect(fileApi.saveContent).toHaveBeenCalledTimes(1);
    expect(editor).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
    expect(screen.getByTitle("Close file preview")).toBeDisabled();
    await act(async () => resolve({ file_id: 7, path: file.path, content: "my edits", content_hash: "b".repeat(64), editable: true, is_binary: false, truncated: false }));
    const afterSave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterSave);
    expect(afterSave.defaultPrevented).toBe(false);
  });

  it("retains CRLF line endings when saving", async () => {
    vi.mocked(fileApi.getContent).mockResolvedValue({ file_id: 7, path: file.path, content: "def main():\r\n    pass\r\n", content_hash: "a".repeat(64), editable: true, is_binary: false, truncated: false });
    render(<FileInspector file={file} onClose={vi.fn()} />);
    const editor = await editFile();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(editor, { target: { value: "def main():\n    return 1\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fileApi.saveContent).toHaveBeenCalledWith(7, "def main():\r\n    return 1\r\n", "a".repeat(64)));
  });

  it("guards native desktop close requests and removes the listener", async () => {
    vi.stubGlobal("__TAURI_INTERNALS__", {});
    const unlisten = vi.fn();
    nativeWindow.onCloseRequested.mockResolvedValue(unlisten);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = render(<FileInspector file={file} onClose={vi.fn()} />);
    const editor = await editFile();
    fireEvent.change(editor, { target: { value: "my edits" } });
    await waitFor(() => expect(nativeWindow.onCloseRequested).toHaveBeenCalled());
    const handler = nativeWindow.onCloseRequested.mock.calls.at(-1)![0];
    const event = { preventDefault: vi.fn() };
    handler(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    handler(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(unlisten).toHaveBeenCalled();
  });

  it("inserts the configured indentation with Tab", async () => {
    localStorage.setItem("devpilot_settings", JSON.stringify({ tabSize: 4 }));
    render(<FileInspector file={file} onClose={vi.fn()} />);
    const editor = await editFile() as HTMLTextAreaElement;
    editor.setSelectionRange(0, 0);
    fireEvent.keyDown(editor, { key: "Tab" });
    expect(editor.value).toBe("    def main():\n    pass");
  });

  it("disables editing when the backend reports a limited preview", async () => {
    vi.mocked(fileApi.getContent).mockResolvedValue({ file_id: 7, path: file.path, content: "partial", is_binary: false, truncated: true, editable: false, editing_disabled_reason: "Files larger than 500 KB cannot be edited." });
    render(<FileInspector file={file} onClose={vi.fn()} />);
    await screen.findByText("partial");
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(screen.getByText("Files larger than 500 KB cannot be edited.")).toBeInTheDocument();
  });
});

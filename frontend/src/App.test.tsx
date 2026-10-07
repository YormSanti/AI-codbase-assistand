import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { RepositoryInfo, TreeNode } from "./types/domain";
import { repositoryApi } from "./api/repositoryApi";
import { editorApi } from "./api/editorApi";
import { ProjectsSidebarNav } from "./components/ProjectsSidebarNav";
import App from "./App";

vi.mock("./hooks/useAutoUpdater", () => ({ useAutoUpdater: vi.fn() }));
vi.mock("./api/editorApi", () => ({ editorApi: { getTree: vi.fn() } }));
vi.mock("./api/repositoryApi", () => ({ repositoryApi: { list: vi.fn(), open: vi.fn(), getTree: vi.fn(), remove: vi.fn() } }));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => children,
  SidebarInset: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/app-sidebar", () => ({
  AppSidebar: ({ repository, onOpenRepository, onOpenTerminal, onSelectTab, onDeleteRepository }: {
    repository: RepositoryInfo | null;
    onOpenRepository: (path: string) => Promise<void>;
    onOpenTerminal: (path: string) => Promise<void>;
    onSelectTab: (tab: string) => void;
    onDeleteRepository: (id: number) => Promise<void>;
  }) => <>
    {["/a", "/b", "/c"].map(path => <button key={path} onClick={() => void onOpenRepository(path).catch(() => {})}>Open {path}</button>)}
    <button onClick={() => onSelectTab("terminal")}>Show terminal</button>
    <button onClick={() => onSelectTab("explorer")}>Show explorer</button>
    <button onClick={() => onSelectTab("editor")}>Code Editor</button>
    <button onClick={() => void onDeleteRepository(1)}>Delete /a</button>
    <ProjectsSidebarNav currentRepository={repository} onOpenRepository={onOpenRepository} onOpenTerminal={onOpenTerminal} onSelectTab={onSelectTab} onDeleteRepository={onDeleteRepository} />
  </>,
}));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/DashboardPage", () => ({ DashboardPage: () => null }));
vi.mock("@/components/AIAgentPage", () => ({ AIAgentPage: () => null }));
vi.mock("@/components/GitPage", () => ({ GitPage: () => null }));
// Use the real terminal page to exercise tab state and WebSocket lifetimes.
vi.mock("xterm", () => ({
  Terminal: class {
    output = document.createElement("pre");
    cols = 80;
    rows = 24;
    loadAddon() {}
    open(container: HTMLElement) { container.appendChild(this.output); }
    write(text: string) { this.output.textContent += text; }
    writeln(text: string) { this.write(text); }
    onData() { return { dispose() {} }; }
    attachCustomKeyEventHandler() {}
    dispose() { this.output.remove(); }
  },
}));
vi.mock("@xterm/addon-fit", () => ({ FitAddon: class { fit() {} dispose() {} } }));
vi.mock("@/components/AnalyticsPage", () => ({ AnalyticsPage: () => null }));
vi.mock("@/components/SettingsPage", () => ({ SettingsPage: () => null }));
vi.mock("@/components/ExplorerPage", () => ({
  ExplorerPage: ({ repository, tree, selectedFile, isLoading, onSelectFile, onEditorStateChange, mode }: {
    repository: RepositoryInfo | null; tree: TreeNode | null; selectedFile: TreeNode | null;
    isLoading: boolean; onSelectFile: (file: TreeNode) => void;
    onEditorStateChange: (state: { dirty: boolean; saving: boolean }) => void;
    mode: "editor" | "explorer";
  }) => <>
    <div data-testid="repository">{repository?.root_path}</div>
    <div data-testid="tree">{tree?.path}</div>
    <div data-testid="selected">{selectedFile?.path}</div>
    <div data-testid="loading">{String(isLoading)}</div>
    <div data-testid="workspace-mode">{mode}</div>
    <button onClick={() => onSelectFile({ name: "file.ts", path: "/a/file.ts", is_directory: false, children: [], language: "typescript", size_bytes: 1, file_id: 1 })}>Select file</button>
    <button onClick={() => onSelectFile({ name: "other.ts", path: "/a/other.ts", is_directory: false, children: [], language: "typescript", size_bytes: 1, file_id: 2 })}>Select other file</button>
    <button onClick={() => onSelectFile({ name: ".env", path: ".env", is_directory: false, children: [], language: "other", size_bytes: 1, file_id: -9 })}>Select ignored file</button>
    <button onClick={() => onEditorStateChange({ dirty: true, saving: false })}>Edit source</button>
    <button onClick={() => onEditorStateChange({ dirty: true, saving: true })}>Saving source</button>
  </>,
}));

const repo = (id: number): RepositoryInfo => ({ id, name: String(id), root_path: `/${String.fromCharCode(96 + id)}`, current_branch: "main", head_commit: null, opened_at: "2026-09-14", file_count: 1 });
const tree = (path: string): TreeNode => ({ name: path, path, is_directory: true, children: [], language: null, size_bytes: null, file_id: null });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class TerminalSocket {
  static OPEN = 1;
  static instances: TerminalSocket[] = [];
  readyState = TerminalSocket.OPEN;
  url: URL;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => this.onclose?.());

  constructor(url: URL) {
    this.url = url;
    TerminalSocket.instances.push(this);
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  TerminalSocket.instances = [];
  vi.stubGlobal("WebSocket", TerminalSocket);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  localStorage.clear();
  localStorage.setItem("ifrog_active_tab", "explorer");
  vi.mocked(repositoryApi.list).mockResolvedValue([repo(1), repo(2), repo(3)]);
  vi.mocked(repositoryApi.getTree).mockImplementation(async id => tree(repo(id).root_path));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("repository switching", () => {
  it("keeps ignored files in Code Editor when discard is canceled and closes them before File Explorer", async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(repositoryApi.open).mockResolvedValue(repo(1));
    render(<App />);
    fireEvent.click(screen.getByText('Open /a'));
    await waitFor(() => expect(screen.getByTestId('repository')).toHaveTextContent('/a'));
    fireEvent.click(screen.getByText('Code Editor'));
    fireEvent.click(screen.getByText('Select ignored file'));
    fireEvent.click(screen.getByText('Edit source'));
    fireEvent.click(screen.getByText('Show explorer'));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('workspace-mode')).toHaveTextContent('editor');
    expect(screen.getByTestId('selected')).toHaveTextContent('.env');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByText('Show explorer'));
    expect(screen.getByTestId('workspace-mode')).toHaveTextContent('explorer');
    expect(screen.getByTestId('selected')).toBeEmptyDOMElement();
  });

  it("restores an editor-only selection without replacing the filtered tree", async () => {
    localStorage.setItem('ifrog_active_tab', 'editor');
    localStorage.setItem('ifrog_repo_path', '/a');
    localStorage.setItem('ifrog_selected_file', '.env');
    vi.mocked(repositoryApi.open).mockResolvedValue(repo(1));
    vi.mocked(editorApi.getTree).mockResolvedValue({ ...tree(''), children: [{ ...tree('.env'), name: '.env', is_directory: false, file_id: -9 }] });
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('.env'));
    expect(editorApi.getTree).toHaveBeenCalledWith(1);
    expect(screen.getByTestId('tree')).toHaveTextContent('/a');
    expect(screen.getByTestId('workspace-mode')).toHaveTextContent('editor');
  });

  it("opens Code Editor from the menu and retains the selected file and unsaved state", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(repositoryApi.open).mockResolvedValue(repo(1));
    render(<App />);
    fireEvent.click(screen.getByText("Open /a"));
    await waitFor(() => expect(screen.getByTestId("repository")).toHaveTextContent("/a"));
    fireEvent.click(screen.getByText("Select file"));
    fireEvent.click(screen.getByText("Edit source"));
    fireEvent.click(screen.getByRole("button", { name: "Code Editor" }));
    expect(screen.getByTestId("workspace-mode")).toHaveTextContent("editor");
    expect(screen.getByTestId("selected")).toHaveTextContent("/a/file.ts");
    expect(localStorage.getItem("ifrog_active_tab")).toBe("editor");
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Show explorer"));
    expect(screen.getByTestId("workspace-mode")).toHaveTextContent("explorer");
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Show terminal"));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByTestId("selected")).toHaveTextContent("/a/file.ts");
  });

  it("keeps the current file, tab, and repository when discarding edits is canceled", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(repositoryApi.open).mockResolvedValue(repo(1));
    render(<App />);
    fireEvent.click(screen.getByText("Open /a"));
    await waitFor(() => expect(screen.getByTestId("repository")).toHaveTextContent("/a"));
    fireEvent.click(screen.getByText("Select file"));
    fireEvent.click(screen.getByText("Edit source"));
    fireEvent.click(screen.getByText("Select other file"));
    expect(screen.getByTestId("selected")).toHaveTextContent("/a/file.ts");
    fireEvent.click(screen.getByText("Show terminal"));
    expect(localStorage.getItem("ifrog_active_tab")).toBe("explorer");
    fireEvent.click(screen.getByText("Open /b"));
    expect(repositoryApi.open).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("repository")).toHaveTextContent("/a");
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByText("Select other file"));
    expect(screen.getByTestId("selected")).toHaveTextContent("/a/other.ts");
    confirm.mockRestore();
  });

  it("blocks navigation while a file is being saved", async () => {
    vi.mocked(repositoryApi.open).mockResolvedValue(repo(1));
    render(<App />);
    fireEvent.click(screen.getByText("Open /a"));
    await waitFor(() => expect(screen.getByTestId("repository")).toHaveTextContent("/a"));
    fireEvent.click(screen.getByText("Select file"));
    fireEvent.click(screen.getByText("Saving source"));
    fireEvent.click(screen.getByText("Show terminal"));
    expect(screen.getByRole("alert")).toHaveTextContent("Please wait for the file to finish saving.");
    expect(localStorage.getItem("ifrog_active_tab")).toBe("explorer");
    fireEvent.click(screen.getByText("Open /b"));
    expect(repositoryApi.open).toHaveBeenCalledTimes(1);
  });

  it("keeps a dirty project and its saved sessions when removal is canceled", async () => {
    vi.mocked(repositoryApi.open).mockResolvedValue(repo(1));
    render(<App />);
    fireEvent.click(screen.getByText("Open /a"));
    await waitFor(() => expect(screen.getByTestId("repository")).toHaveTextContent("/a"));
    localStorage.setItem("threads_1", "saved sessions");
    fireEvent.click(screen.getByText("Edit source"));
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(true).mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Remove 1" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Project removal canceled.");
    expect(repositoryApi.remove).not.toHaveBeenCalled();
    expect(localStorage.getItem("threads_1")).toBe("saved sessions");
    expect(screen.getByTestId("repository")).toHaveTextContent("/a");
    confirm.mockRestore();
  });

  it("keeps the current project and selected file when the next project fails to load", async () => {
    vi.mocked(repositoryApi.open).mockResolvedValueOnce(repo(1)).mockRejectedValueOnce(new Error("Missing repository"));
    render(<App />);
    fireEvent.click(screen.getByText("Open /a"));
    await waitFor(() => expect(screen.getByTestId("repository")).toHaveTextContent("/a"));
    fireEvent.click(screen.getByText("Select file"));
    fireEvent.click(screen.getByText("Open /b"));
    await screen.findByRole("alert");
    expect(screen.getByTestId("repository")).toHaveTextContent("/a");
    expect(screen.getByTestId("tree")).toHaveTextContent("/a");
    expect(screen.getByTestId("selected")).toHaveTextContent("/a/file.ts");
    expect(localStorage.getItem("ifrog_repo_path")).toBe("/a");
  });

  it("keeps the newest selection when an earlier tree request finishes late", async () => {
    const slowTree = deferred<TreeNode>();
    vi.mocked(repositoryApi.open).mockResolvedValueOnce(repo(1)).mockResolvedValueOnce(repo(2));
    vi.mocked(repositoryApi.getTree).mockImplementation(id => id === 1 ? slowTree.promise : Promise.resolve(tree("/b")));
    render(<App />);
    fireEvent.click(screen.getByText("Open /a"));
    await waitFor(() => expect(repositoryApi.getTree).toHaveBeenCalledWith(1));
    fireEvent.click(screen.getByText("Open /b"));
    await waitFor(() => expect(screen.getByTestId("repository")).toHaveTextContent("/b"));
    await act(async () => slowTree.resolve(tree("/a")));
    expect(screen.getByTestId("repository")).toHaveTextContent("/b");
    expect(screen.getByTestId("tree")).toHaveTextContent("/b");
  });

  it("ignores stale failures while the newest selection is still loading", async () => {
    const old = deferred<RepositoryInfo>();
    const latest = deferred<RepositoryInfo>();
    vi.mocked(repositoryApi.open).mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    render(<App />);
    fireEvent.click(screen.getByText("Open /a"));
    fireEvent.click(screen.getByText("Open /b"));
    await act(async () => old.reject(new Error("Old request failed")));
    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(async () => latest.resolve(repo(2)));
    expect(screen.getByTestId("repository")).toHaveTextContent("/b");
  });

  it("does not let startup restoration overwrite a project opened by the user", async () => {
    const restored = deferred<RepositoryInfo>();
    localStorage.setItem("ifrog_repo_path", "/a");
    vi.mocked(repositoryApi.open).mockReturnValueOnce(restored.promise).mockResolvedValueOnce(repo(2));
    render(<App />);
    fireEvent.click(screen.getByText("Open /b"));
    await waitFor(() => expect(screen.getByTestId("repository")).toHaveTextContent("/b"));
    await act(async () => restored.resolve(repo(1)));
    expect(screen.getByTestId("repository")).toHaveTextContent("/b");
  });
});

describe("project terminals", () => {
  beforeEach(() => {
    vi.mocked(repositoryApi.open).mockImplementation(async path => repo(path.charCodeAt(1) - 96));
  });

  async function openTerminal(path: string) {
    fireEvent.click(screen.getByText(`Open ${path}`));
    await waitFor(() => expect(localStorage.getItem("ifrog_repo_path")).toBe(path));
    fireEvent.click(screen.getByText("Show terminal"));
    await waitFor(() => expect(TerminalSocket.instances.some(socket => socket.url.searchParams.get("cwd") === path)).toBe(true));
  }

  it("keeps each project's shells, output, and tabs when switching projects", async () => {
    render(<App />);
    await openTerminal("/a");
    fireEvent.click(screen.getByRole("button", { name: "New terminal" }));
    await waitFor(() => expect(TerminalSocket.instances).toHaveLength(2));
    const [first, second] = TerminalSocket.instances;
    second.onmessage?.({ data: "Project A is still running" });
    expect(await screen.findByText("Project A is still running")).toBeVisible();

    await openTerminal("/b");
    expect(first.close).not.toHaveBeenCalled();
    expect(second.close).not.toHaveBeenCalled();
    expect(TerminalSocket.instances).toHaveLength(3);
    expect(screen.getByText("Project A is still running")).not.toBeVisible();
    expect(screen.getByText("Tab 2")).not.toBeVisible();
    const third = TerminalSocket.instances[2];
    third.onmessage?.({ data: "Project B is still running" });
    expect(await screen.findByText("Project B is still running")).toBeVisible();

    await openTerminal("/a");
    expect(TerminalSocket.instances).toHaveLength(3);
    expect(screen.getByText("Project A is still running")).toBeVisible();
    expect(screen.getByText("Tab 2")).toBeVisible();
    expect(screen.getByText("Project B is still running")).not.toBeVisible();
    expect(third.close).not.toHaveBeenCalled();
  });

  it("only starts a project's terminal when its terminal view is opened", async () => {
    render(<App />);
    await openTerminal("/a");
    const first = TerminalSocket.instances[0];
    fireEvent.click(screen.getByText("Show explorer"));
    fireEvent.click(screen.getByText("Open /b"));
    await waitFor(() => expect(screen.getByTestId("repository")).toHaveTextContent("/b"));
    expect(TerminalSocket.instances).toHaveLength(1);
    expect(first.close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Show terminal"));
    await waitFor(() => expect(TerminalSocket.instances).toHaveLength(2));
  });

  it("keeps the home terminal separate from project terminals", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("Show terminal"));
    await waitFor(() => expect(TerminalSocket.instances).toHaveLength(1));
    const home = TerminalSocket.instances[0];
    expect(home.url.searchParams.has("cwd")).toBe(false);
    await openTerminal("/a");
    expect(home.close).not.toHaveBeenCalled();
    expect(TerminalSocket.instances).toHaveLength(2);
  });

  it("closes only the deleted project's terminals and cleans up on exit", async () => {
    const { unmount } = render(<App />);
    await openTerminal("/a");
    await openTerminal("/b");
    const [first, second] = TerminalSocket.instances;
    expect(first.close).not.toHaveBeenCalled();
    expect(second.close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Delete /a"));
    await waitFor(() => expect(repositoryApi.remove).toHaveBeenCalledWith(1));
    await waitFor(() => expect(first.close).toHaveBeenCalledTimes(1));
    expect(second.close).not.toHaveBeenCalled();
    unmount();
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).toHaveBeenCalledTimes(1);
  });

  it("waits for the saved project before starting its terminal", async () => {
    const restored = deferred<RepositoryInfo>();
    localStorage.setItem("ifrog_active_tab", "terminal");
    localStorage.setItem("ifrog_repo_path", "/a");
    vi.mocked(repositoryApi.open).mockReturnValueOnce(restored.promise);
    render(<App />);
    // Flush connection microtasks while the repository is still restoring.
    await act(async () => {});
    expect(TerminalSocket.instances).toHaveLength(0);
    await act(async () => restored.resolve(repo(1)));
    await waitFor(() => expect(TerminalSocket.instances).toHaveLength(1));
    expect(TerminalSocket.instances[0].url.searchParams.get("cwd")).toBe("/a");
  });

  it("opens another project's terminal from the sidebar after that project finishes loading", async () => {
    render(<App />);
    await openTerminal("/a");
    const first = TerminalSocket.instances[0];
    first.onmessage?.({ data: "Project A output" });
    await screen.findByText("Project A output");
    fireEvent.click(screen.getByText("Show explorer"));
    const pendingTree = deferred<TreeNode>();
    vi.mocked(repositoryApi.getTree).mockReturnValueOnce(pendingTree.promise);

    const button = await screen.findByRole("button", { name: "Open terminal for 2" });
    fireEvent.click(button);
    await waitFor(() => expect(repositoryApi.getTree).toHaveBeenLastCalledWith(2));
    expect(button).toBeDisabled();
    expect(TerminalSocket.instances).toHaveLength(1);
    expect(localStorage.getItem("ifrog_active_tab")).toBe("explorer");
    await act(async () => pendingTree.resolve(tree("/b")));

    await waitFor(() => expect(TerminalSocket.instances).toHaveLength(2));
    expect(TerminalSocket.instances[1].url.searchParams.get("cwd")).toBe("/b");
    expect(localStorage.getItem("ifrog_active_tab")).toBe("terminal");
    expect(first.close).not.toHaveBeenCalled();
    expect(screen.getByText("Project A output")).not.toBeVisible();

    fireEvent.click(await screen.findByRole("button", { name: "Open terminal for 1" }));
    await waitFor(() => expect(screen.getByText("Project A output")).toBeVisible());
    expect(TerminalSocket.instances).toHaveLength(2);
  });

  it("does not navigate to a terminal when a newer project selection wins", async () => {
    render(<App />);
    const pendingTree = deferred<TreeNode>();
    vi.mocked(repositoryApi.getTree).mockReturnValueOnce(pendingTree.promise);
    fireEvent.click(await screen.findByRole("button", { name: "Open terminal for 2" }));
    await waitFor(() => expect(repositoryApi.getTree).toHaveBeenCalledWith(2));
    fireEvent.click(screen.getByText("Open /c"));
    await waitFor(() => expect(screen.getByTestId("repository")).toHaveTextContent("/c"));
    await act(async () => pendingTree.resolve(tree("/b")));
    expect(screen.getByTestId("repository")).toHaveTextContent("/c");
    expect(localStorage.getItem("ifrog_active_tab")).toBe("explorer");
    expect(TerminalSocket.instances).toHaveLength(0);
  });

  it("allows opening another project's terminal while startup restoration is pending", async () => {
    const restored = deferred<RepositoryInfo>();
    localStorage.setItem("ifrog_active_tab", "terminal");
    localStorage.setItem("ifrog_repo_path", "/a");
    vi.mocked(repositoryApi.open).mockReturnValueOnce(restored.promise);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open terminal for 2" }));
    await waitFor(() => expect(TerminalSocket.instances).toHaveLength(1));
    expect(TerminalSocket.instances[0].url.searchParams.get("cwd")).toBe("/b");
    await act(async () => restored.resolve(repo(1)));
    expect(localStorage.getItem("ifrog_repo_path")).toBe("/b");
    expect(TerminalSocket.instances).toHaveLength(1);
  });
});

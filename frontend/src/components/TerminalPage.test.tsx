import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TerminalPage } from "./TerminalPage";

const { state, MockTerminal } = vi.hoisted(() => {
  const state = {
    attachedKeyHandler: null as ((e: KeyboardEvent) => boolean) | null,
    lastCreatedTerminal: null as any,
  };

  class MockTerminal {
    output = document.createElement("pre");
    cols = 80;
    rows = 24;
    selection = "";
    cleared = false;
    pastedText = "";

    constructor() {
      state.lastCreatedTerminal = this;
    }

    loadAddon() {}
    open(container: HTMLElement) {
      container.appendChild(this.output);
    }
    write(text: string) {
      this.output.textContent += text;
    }
    writeln(text: string) {
      this.write(text + "\n");
    }
    onData() {
      return { dispose() {} };
    }
    attachCustomKeyEventHandler(handler: (e: KeyboardEvent) => boolean) {
      state.attachedKeyHandler = handler;
    }
    hasSelection() {
      return Boolean(this.selection);
    }
    getSelection() {
      return this.selection;
    }
    selectAll() {
      this.selection = "all selected content";
    }
    clear() {
      this.cleared = true;
      this.output.textContent = "";
    }
    paste(text: string) {
      this.pastedText = text;
      this.write(text);
    }
    focus() {}
    dispose() {
      this.output.remove();
    }
  }

  return { state, MockTerminal };
});

vi.mock("xterm", () => ({
  Terminal: MockTerminal,
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit() {}
    dispose() {}
  },
}));

vi.mock("@/api/client", () => ({
  getBackendUrl: vi.fn().mockResolvedValue("http://127.0.0.1:8000"),
}));

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];
  url: string | URL;
  readyState = 1;
  sentData: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string | URL) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string) {
    this.sentData.push(data);
  }

  close(code = 1000) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

vi.stubGlobal("WebSocket", MockWebSocket);

describe("TerminalPage", () => {
  beforeEach(() => {
    state.attachedKeyHandler = null;
    state.lastCreatedTerminal = null;
    MockWebSocket.instances = [];
    vi.clearAllMocks();
  });

  it("renders terminal tabs, action buttons, and opens WebSocket connection", async () => {
    render(<TerminalPage repository={{ id: 1, name: "test-repo", root_path: "/test/path" } as any} />);

    expect(screen.getByText("Tab 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new terminal/i })).toBeInTheDocument();
    expect(screen.getByTitle(/toggle full screen/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      const urlStr = String(MockWebSocket.instances[0].url);
      expect(urlStr).toContain("/ws/terminal");
      expect(urlStr).toContain("cwd=%2Ftest%2Fpath");
    });
  });

  it("allows creating and closing multiple tabs and panes", async () => {
    const user = userEvent.setup();
    render(<TerminalPage repository={null} />);

    const newTermButton = screen.getByRole("button", { name: /new terminal/i });
    await user.click(newTermButton);

    expect(screen.getByText("Tab 2")).toBeInTheDocument();

    const splitButtons = screen.getAllByTitle(/split terminal/i);
    await user.click(splitButtons[splitButtons.length - 1]);

    expect(screen.getByText("Terminal 2")).toBeInTheDocument();
  });

  it("handles double-click to rename a tab", async () => {
    const user = userEvent.setup();
    render(<TerminalPage repository={null} />);

    const tab1 = screen.getByText("Tab 1");
    await user.dblClick(tab1);

    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "Build Server{Enter}");

    expect(screen.getByText("Build Server")).toBeInTheDocument();
  });

  it("handles copy shortcut correctly: prevents SIGINT when selection exists, passes through when not", async () => {
    render(<TerminalPage repository={null} />);

    await waitFor(() => expect(state.attachedKeyHandler).not.toBeNull());

    // Without selection: Ctrl+C should return true so PTY receives SIGINT
    state.lastCreatedTerminal!.selection = "";
    const eventWithoutSelection = new KeyboardEvent("keydown", { key: "c", ctrlKey: true });
    expect(state.attachedKeyHandler!(eventWithoutSelection)).toBe(true);

    // With selection: Ctrl+C should copy and return false to prevent SIGINT
    state.lastCreatedTerminal!.selection = "selected bash command";
    const eventWithSelection = new KeyboardEvent("keydown", { key: "c", ctrlKey: true });
    expect(state.attachedKeyHandler!(eventWithSelection)).toBe(false);
  });

  it("handles paste shortcut (Ctrl+V and Ctrl+Shift+V)", async () => {
    render(<TerminalPage repository={null} />);

    await waitFor(() => expect(state.attachedKeyHandler).not.toBeNull());

    const ctrlV = new KeyboardEvent("keydown", { key: "v", ctrlKey: true });
    expect(state.attachedKeyHandler!(ctrlV)).toBe(false);

    const ctrlShiftV = new KeyboardEvent("keydown", { key: "v", ctrlKey: true, shiftKey: true });
    expect(state.attachedKeyHandler!(ctrlShiftV)).toBe(false);
  });

  it("handles clear terminal shortcut (Ctrl+K) and toolbar button", async () => {
    const user = userEvent.setup();
    render(<TerminalPage repository={null} />);

    await waitFor(() => expect(state.attachedKeyHandler).not.toBeNull());

    // Shortcut
    const ctrlK = new KeyboardEvent("keydown", { key: "k", ctrlKey: true });
    expect(state.attachedKeyHandler!(ctrlK)).toBe(false);
    expect(state.lastCreatedTerminal!.cleared).toBe(true);

    // Toolbar button
    state.lastCreatedTerminal!.cleared = false;
    const clearButton = screen.getByTitle(/clear terminal buffer/i);
    await user.click(clearButton);
    expect(state.lastCreatedTerminal!.cleared).toBe(true);
  });

  it("opens context menu on right click and supports select all, copy, paste, clear, restart", async () => {
    const user = userEvent.setup();
    const { container } = render(<TerminalPage repository={null} />);

    await waitFor(() => expect(container.querySelector("pre")).toBeInTheDocument());
    const terminalCanvas = container.querySelector("pre");

    state.lastCreatedTerminal!.selection = "some text to copy";
    fireEvent.contextMenu(terminalCanvas!, { clientX: 100, clientY: 100 });

    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /paste/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /select all/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /clear/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: /restart/i }).length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole("button", { name: /select all/i }));
    expect(state.lastCreatedTerminal!.selection).toBe("all selected content");
  });
});

import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Plus, X } from "lucide-react";
import { Terminal as XTerm } from "xterm";
import "xterm/css/xterm.css";
import { getBackendUrl } from "@/api/client";
import type { RepositoryInfo } from "@/types/domain";

interface TerminalTab {
  id: number;
  title: string;
}

async function readClipboardText(): Promise<string> {
  if ("__TAURI_INTERNALS__" in window) {
    const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
    return readText();
  }
  return navigator.clipboard.readText();
}

async function writeClipboardText(text: string): Promise<void> {
  if ("__TAURI_INTERNALS__" in window) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}

function TerminalSession({
  repository,
  isActive,
}: {
  repository: RepositoryInfo | null;
  isActive: boolean;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;
    const terminalElement = terminalRef.current;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "var(--font-code)",
      fontSize: 14,
      theme: {
        background: "#0a0a0e",
        foreground: "#d1d5db",
        cursor: "#a78bfa",
        cursorAccent: "#000000",
        selectionBackground: "rgba(139, 92, 246, 0.3)",
        black: "#000000",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#d946ef",
        cyan: "#06b6d4",
        white: "#ffffff",
        brightBlack: "#525252",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#fde047",
        brightBlue: "#60a5fa",
        brightMagenta: "#e879f9",
        brightCyan: "#22d3ee",
        brightWhite: "#ffffff",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalElement);
    fitAddonRef.current = fitAddon;

    let disposed = false;
    let ws: WebSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const handleResize = () => {
      if (!disposed && terminalElement.offsetParent) fitAddon.fit();
    };
    window.addEventListener("resize", handleResize);

    const connect = async () => {
      try {
        const backendUrl = await getBackendUrl();
        if (disposed) return;
        const wsUrl = new URL("/ws/terminal", backendUrl);
        wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
        if (repository?.root_path) wsUrl.searchParams.set("cwd", repository.root_path);

        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => term.write(event.data);
        ws.onerror = () => {
          term.writeln("\r\n\x1b[1;31mTerminal backend is not ready.\x1b[0m");
        };
        ws.onclose = () => {
          if (!disposed) {
            term.writeln("\r\n\x1b[1;33mReconnecting terminal...\x1b[0m");
            reconnectTimer = setTimeout(connect, 1000);
          }
        };
      } catch (error) {
        term.writeln(`\r\n\x1b[1;31mCould not start terminal: ${String(error)}\x1b[0m`);
      }
    };

    void connect();
    const dataDisposable = term.onData(data => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(data);
    });

    const isMac = navigator.userAgent.includes("Mac");
    term.attachCustomKeyEventHandler(event => {
      if (event.type !== "keydown") return true;

      const key = event.key.toLowerCase();
      const copyShortcut =
        (key === "c" && (isMac ? event.metaKey : event.ctrlKey && event.shiftKey)) ||
        (key === "insert" && event.ctrlKey && !event.shiftKey);
      const pasteShortcut =
        (key === "v" && (isMac ? event.metaKey : event.ctrlKey && event.shiftKey)) ||
        (key === "insert" && event.shiftKey && !event.ctrlKey);

      if (copyShortcut) {
        const selection = term.getSelection();
        if (selection) void writeClipboardText(selection);
        return false;
      }
      if (pasteShortcut) {
        void readClipboardText().then(text => term.paste(text));
        return false;
      }
      return true;
    });

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      void readClipboardText().then(text => term.paste(text));
    };
    terminalElement.addEventListener("contextmenu", handleContextMenu);

    return () => {
      disposed = true;
      window.removeEventListener("resize", handleResize);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      terminalElement.removeEventListener("contextmenu", handleContextMenu);
      dataDisposable.dispose();
      ws?.close();
      fitAddonRef.current = null;
      fitAddon.dispose();
      term.dispose();
    };
  }, [repository?.root_path]);

  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => fitAddonRef.current?.fit(), 50);
    return () => clearTimeout(timer);
  }, [isActive]);

  return <div ref={terminalRef} style={{ width: "100%", height: "100%" }} />;
}

export function TerminalPage({ repository }: { repository: RepositoryInfo | null }) {
  const nextId = useRef(2);
  const [tabs, setTabs] = useState<TerminalTab[]>([{ id: 1, title: "Terminal 1" }]);
  const [activeId, setActiveId] = useState(1);

  const addTerminal = () => {
    const id = nextId.current++;
    setTabs(current => [...current, { id, title: `Terminal ${id}` }]);
    setActiveId(id);
  };

  const closeTerminal = (id: number) => {
    if (tabs.length === 1) return;
    const index = tabs.findIndex(tab => tab.id === id);
    const remaining = tabs.filter(tab => tab.id !== id);
    setTabs(remaining);
    if (id === activeId) setActiveId(remaining[Math.max(0, index - 1)].id);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      padding: "20px",
      background: "var(--background)",
      boxSizing: "border-box",
    }}>
      <div style={{
        display: "flex",
        alignItems: "end",
        gap: "4px",
        minHeight: "36px",
        overflowX: "auto",
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveId(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              height: "34px",
              padding: "0 10px 0 14px",
              border: "1px solid rgba(255,255,255,0.1)",
              borderBottom: activeId === tab.id ? "2px solid #8b5cf6" : "1px solid rgba(255,255,255,0.1)",
              borderRadius: "9px 9px 0 0",
              background: activeId === tab.id ? "#0a0a0e" : "rgba(255,255,255,0.04)",
              color: activeId === tab.id ? "var(--foreground)" : "var(--muted-foreground)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontSize: "12px",
            }}
          >
            <span>{tab.title}</span>
            {tabs.length > 1 && (
              <span
                role="button"
                aria-label={`Close ${tab.title}`}
                onClick={event => {
                  event.stopPropagation();
                  closeTerminal(tab.id);
                }}
                style={{ display: "flex", padding: "2px", borderRadius: "4px" }}
              >
                <X size={13} />
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={addTerminal}
          aria-label="New terminal"
          title="New terminal"
          style={{
            display: "grid",
            placeItems: "center",
            width: "32px",
            height: "32px",
            marginBottom: "2px",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.04)",
            color: "var(--muted-foreground)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      <div style={{
        flex: 1,
        minHeight: 0,
        borderRadius: "0 16px 16px 16px",
        overflow: "hidden",
        background: "#0a0a0e",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "16px",
      }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            style={{ display: activeId === tab.id ? "block" : "none", width: "100%", height: "100%" }}
          >
            <TerminalSession repository={repository} isActive={activeId === tab.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

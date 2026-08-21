import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Plus, SquareTerminal, X } from "lucide-react";
import { Terminal as XTerm } from "xterm";
import "xterm/css/xterm.css";
import { getBackendUrl } from "@/api/client";
import type { RepositoryInfo } from "@/types/domain";

interface TerminalPane {
  id: number;
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

    const sendSize = () => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(`\0DEVPILOT_RESIZE:${term.cols}:${term.rows}`);
      }
    };

    const handleResize = () => {
      if (!disposed && terminalElement.offsetParent) {
        fitAddon.fit();
        sendSize();
      }
    };
    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalElement);

    const connect = async () => {
      try {
        const backendUrl = await getBackendUrl();
        if (disposed) return;
        const wsUrl = new URL("/ws/terminal", backendUrl);
        wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
        if (repository?.root_path) wsUrl.searchParams.set("cwd", repository.root_path);

        ws = new WebSocket(wsUrl);
        ws.onopen = () => handleResize();
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
      resizeObserver.disconnect();
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
  const [panes, setPanes] = useState<TerminalPane[]>([{ id: 1 }]);
  const [activeId, setActiveId] = useState(1);

  const addTerminal = () => {
    const id = nextId.current++;
    setPanes(current => [...current, { id }]);
    setActiveId(id);
  };

  const closeTerminal = (id: number) => {
    if (panes.length === 1) return;
    const index = panes.findIndex(pane => pane.id === id);
    const remaining = panes.filter(pane => pane.id !== id);
    setPanes(remaining);
    if (id === activeId) setActiveId(remaining[Math.max(0, index - 1)].id);
  };

  const gridStyle = (): React.CSSProperties => {
    if (panes.length === 1) return { gridTemplateColumns: "minmax(0, 1fr)" };
    if (panes.length === 2) return { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" };
    if (panes.length <= 4) {
      return {
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gridTemplateRows: "repeat(2, minmax(0, 1fr))",
      };
    }

    const columns = Math.ceil(Math.sqrt(panes.length));
    return {
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gridAutoRows: "minmax(0, 1fr)",
    };
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
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        minHeight: "42px",
        marginBottom: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "9px", color: "var(--muted-foreground)" }}>
          <SquareTerminal size={17} color="#a78bfa" />
          <span style={{ fontSize: "12px", fontWeight: 700 }}>Terminal workspace</span>
          <span style={{ fontSize: "11px", opacity: 0.65 }}>{panes.length} {panes.length === 1 ? "pane" : "panes"}</span>
        </div>
        <button
          type="button"
          onClick={addTerminal}
          aria-label="New terminal"
          title="Add another terminal pane"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            height: "34px",
            padding: "0 12px",
            border: "1px solid rgba(139,92,246,0.4)",
            borderRadius: "9px",
            background: "rgba(139,92,246,0.12)",
            color: "#c4b5fd",
            cursor: "pointer",
            flexShrink: 0,
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          <Plus size={16} />
          Add terminal
        </button>
      </div>

      <div style={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        gap: "7px",
        ...gridStyle(),
      }}>
        {panes.map((pane, index) => (
          <div
            key={pane.id}
            onMouseDown={() => setActiveId(pane.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
              borderRadius: "12px",
              background: "#0a0a0e",
              border: activeId === pane.id ? "1px solid rgba(139,92,246,0.7)" : "1px solid rgba(255,255,255,0.1)",
              boxShadow: activeId === pane.id ? "0 0 0 1px rgba(139,92,246,0.15)" : "none",
              ...(panes.length === 3 && index === 0 ? { gridRow: "1 / span 2" } : {}),
            }}
          >
            <div style={{
              height: "32px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 8px 0 11px",
              background: activeId === pane.id ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.035)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <SquareTerminal size={13} color={activeId === pane.id ? "#a78bfa" : "#71717a"} />
                <span style={{ fontSize: "11px", fontWeight: 700, color: activeId === pane.id ? "#ddd6fe" : "#a1a1aa" }}>
                  Terminal {index + 1}
                </span>
              </div>
              {panes.length > 1 && (
                <button
                  type="button"
                  aria-label={`Close Terminal ${index + 1}`}
                  title={`Close Terminal ${index + 1}`}
                  onClick={event => {
                    event.stopPropagation();
                    closeTerminal(pane.id);
                  }}
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: "22px",
                    height: "22px",
                    padding: 0,
                    border: "none",
                    borderRadius: "5px",
                    background: "transparent",
                    color: "#71717a",
                    cursor: "pointer",
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: "9px 10px" }}>
              <TerminalSession repository={repository} isActive={activeId === pane.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

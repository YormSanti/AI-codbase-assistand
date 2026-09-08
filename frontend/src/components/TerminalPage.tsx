import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Plus, SquareTerminal, X, Maximize, Minimize } from "lucide-react";
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
    
    // Defer open to ensure DOM has painted and has dimensions
    setTimeout(() => {
      if (disposed) return;
      try {
        term.open(terminalElement);
        fitAddonRef.current = fitAddon;
        fitAddon.fit();
      } catch (e) {
        console.error("Terminal open error:", e);
      }
    }, 10);

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
        try {
          fitAddon.fit();
          sendSize();
        } catch {}
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
    const timer = setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
      } catch {}
    }, 50);
    return () => clearTimeout(timer);
  }, [isActive]);

  return <div ref={terminalRef} style={{ width: "100%", height: "100%" }} />;
}

export function TerminalPage({ repository, isActive = true }: { repository: RepositoryInfo | null, isActive?: boolean }) {
  const nextPaneId = useRef(2);
  const nextTabId = useRef(2);
  
  interface TabData {
    id: number;
    panes: TerminalPane[];
    activePaneId: number;
  }
  
  const [tabs, setTabs] = useState<TabData[]>([{ id: 1, panes: [{ id: 1 }], activePaneId: 1 }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };


  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const addTab = () => {
    const tId = nextTabId.current++;
    const pId = nextPaneId.current++;
    setTabs(current => [...current, { id: tId, panes: [{ id: pId }], activePaneId: pId }]);
    setActiveTabId(tId);
  };
  
  const closeTab = (id: number) => {
    if (tabs.length === 1) return;
    const index = tabs.findIndex(t => t.id === id);
    const remaining = tabs.filter(t => t.id !== id);
    setTabs(remaining);
    if (id === activeTabId) setActiveTabId(remaining[Math.max(0, index - 1)].id);
  };

  const addSplit = (tabId: number) => {
    const pId = nextPaneId.current++;
    setTabs(current => current.map(t => {
      if (t.id === tabId) {
        return { ...t, panes: [...t.panes, { id: pId }], activePaneId: pId };
      }
      return t;
    }));
  };

  const closeSplit = (tabId: number, paneId: number) => {
    setTabs(current => current.map(t => {
      if (t.id === tabId) {
        if (t.panes.length === 1) return t;
        const index = t.panes.findIndex(p => p.id === paneId);
        const remaining = t.panes.filter(p => p.id !== paneId);
        return {
          ...t,
          panes: remaining,
          activePaneId: t.activePaneId === paneId ? remaining[Math.max(0, index - 1)].id : t.activePaneId
        };
      }
      return t;
    }));
  };

  const setActivePane = (tabId: number, paneId: number) => {
    setTabs(current => current.map(t => t.id === tabId ? { ...t, activePaneId: paneId } : t));
  };

  const gridStyle = (panesCount: number): React.CSSProperties => {
    if (panesCount === 1) return { gridTemplateColumns: "minmax(0, 1fr)" };
    if (panesCount === 2) return { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" };
    if (panesCount <= 4) {
      return {
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gridTemplateRows: "repeat(2, minmax(0, 1fr))",
      };
    }
    const columns = Math.ceil(Math.sqrt(panesCount));
    return {
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gridAutoRows: "minmax(0, 1fr)",
    };
  };

  return (
    <div ref={containerRef} style={{
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
        <div style={{ display: "flex", alignItems: "center", gap: "9px", overflowX: "auto" }}>
          <SquareTerminal size={17} color="#a78bfa" />
          {tabs.map((tab, idx) => (
             <div 
               key={tab.id}
               onClick={() => setActiveTabId(tab.id)}
               style={{
                 display: "flex", alignItems: "center", gap: "6px",
                 padding: "6px 12px",
                 background: activeTabId === tab.id ? "rgba(139,92,246,0.15)" : "transparent",
                 border: activeTabId === tab.id ? "1px solid rgba(139,92,246,0.4)" : "1px solid transparent",
                 borderRadius: "6px",
                 cursor: "pointer",
                 color: activeTabId === tab.id ? "#c4b5fd" : "var(--muted-foreground)",
                 fontSize: "12px", fontWeight: 600
               }}
             >
               Tab {idx + 1}
               {tabs.length > 1 && (
                 <X 
                   size={12} 
                   onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} 
                   style={{ opacity: 0.7, cursor: "pointer" }}
                 />
               )}
             </div>
          ))}
        </div>
                <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Toggle full screen"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "34px",
              height: "34px",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "9px",
              background: "rgba(255,255,255,0.05)",
              color: "var(--muted-foreground)",
              cursor: "pointer",
            }}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          <button
            type="button"
            onClick={addTab}
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
            New terminal
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              visibility: activeTabId === tab.id ? "visible" : "hidden",
              zIndex: activeTabId === tab.id ? 1 : -1,
              pointerEvents: activeTabId === tab.id ? "auto" : "none",
              gap: "7px",
              ...gridStyle(tab.panes.length),
            }}
          >
            {tab.panes.map((pane, index) => (
              <div
                key={pane.id}
                onMouseDown={() => setActivePane(tab.id, pane.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                  minHeight: 0,
                  overflow: "hidden",
                  borderRadius: "12px",
                  background: "#0a0a0e",
                  border: tab.activePaneId === pane.id ? "1px solid rgba(139,92,246,0.7)" : "1px solid rgba(255,255,255,0.1)",
                  boxShadow: tab.activePaneId === pane.id ? "0 0 0 1px rgba(139,92,246,0.15)" : "none",
                  ...(tab.panes.length === 3 && index === 0 ? { gridRow: "1 / span 2" } : {}),
                }}
              >
            <div style={{
              height: "32px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 8px 0 11px",
              background: activeTab.activePaneId === pane.id ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.035)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <SquareTerminal size={13} color={tab.activePaneId === pane.id ? "#a78bfa" : "#71717a"} />
                <span style={{ fontSize: "11px", fontWeight: 700, color: tab.activePaneId === pane.id ? "#ddd6fe" : "#a1a1aa" }}>
                  Terminal {index + 1}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); addSplit(tab.id); }}
                  style={{
                    display: "grid", placeItems: "center", width: "22px", height: "22px",
                    padding: 0, border: "none", borderRadius: "5px", background: "transparent",
                    color: "#71717a", cursor: "pointer",
                  }}
                >
                  <Plus size={13} />
                </button>
                {tab.panes.length > 1 && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); closeSplit(tab.id, pane.id); }}
                    style={{
                      display: "grid", placeItems: "center", width: "22px", height: "22px",
                      padding: 0, border: "none", borderRadius: "5px", background: "transparent",
                      color: "#71717a", cursor: "pointer",
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
              <div style={{ position: "absolute", inset: "9px 10px" }}>
                <TerminalSession repository={repository} isActive={isActive && tab.activePaneId === pane.id && activeTabId === tab.id} />
              </div>
            </div>
          </div>
        ))}
          </div>
        ))}
      </div>
    </div>
  );
}

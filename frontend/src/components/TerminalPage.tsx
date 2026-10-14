import { useEffect, useRef, useState, useCallback } from "react";
import { FitAddon } from "@xterm/addon-fit";
import {
  ChevronDown,
  ClipboardPaste,
  Copy,
  GitBranch,
  Maximize,
  Minimize,
  PanelsLeftRight,
  Plus,
  RotateCw,
  SquareTerminal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Terminal as XTerm } from "xterm";
import "xterm/css/xterm.css";
import { getBackendUrl } from "@/api/client";
import type { RepositoryInfo } from "@/types/domain";

interface TerminalPane {
  id: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  hasSelection: boolean;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

async function readClipboardText(): Promise<string> {
  try {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
      const text = await readText();
      return text || "";
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
      return (await navigator.clipboard.readText()) || "";
    }
  } catch (err) {
    console.warn("Clipboard read failed:", err);
  }
  return "";
}

async function writeClipboardText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(text);
      toast.success("Copied to clipboard");
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
      return true;
    }
  } catch (err) {
    console.warn("Clipboard API write failed, trying fallback:", err);
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (successful) {
      toast.success("Copied to clipboard");
      return true;
    }
  } catch (fallbackErr) {
    console.error("Clipboard fallback failed:", fallbackErr);
  }
  return false;
}

function TerminalSession({
  repository,
  isActive,
  onRegisterActions,
}: {
  repository: RepositoryInfo | null;
  isActive: boolean;
  onRegisterActions?: (actions: { clear: () => void; restart: () => void }) => void;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | undefined>(undefined);
  const sendSizeRef = useRef<(() => void) | null>(null);
  const restartRef = useRef<(() => void) | null>(null);
  const handlePasteRef = useRef<(text: string) => void>(() => {});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const isExitedRef = useRef(false);

  const restart = useCallback(() => {
    restartRef.current?.();
  }, []);

  const clear = useCallback(() => {
    termRef.current?.clear?.();
  }, []);

  useEffect(() => {
    onRegisterActions?.({ clear, restart });
  }, [clear, restart, onRegisterActions]);

  // Close context menu on outside click or escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleDown = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!terminalRef.current) return;
    const terminalElement = terminalRef.current;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: "block",
      cursorInactiveStyle: "outline",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Menlo, Monaco, Consolas, monospace",
      fontSize: 13.5,
      lineHeight: 1.15,
      letterSpacing: 0,
      scrollback: 10000,
      convertEol: false,
      allowProposedApi: true,
      macOptionIsMeta: true,
      smoothScrollDuration: 0,
      scrollOnUserInput: true,
      fastScrollModifier: "alt",
      theme: {
        background: "#0c0d12",
        foreground: "#e4e4e7",
        cursor: "#a78bfa",
        cursorAccent: "#0c0d12",
        selectionBackground: "rgba(167, 139, 250, 0.3)",
        selectionForeground: "#ffffff",
        black: "#18181b",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#fbbf24",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#38bdf8",
        white: "#f4f4f5",
        brightBlack: "#52525b",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fde047",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#ffffff",
      },
    });
    termRef.current = term;

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let resizeRaf: number | null = null;
    const lastDimensions = { cols: 0, rows: 0 };

    setTimeout(() => {
      if (disposed) return;
      try {
        term.open(terminalElement);
        fitAddonRef.current = fitAddon;
        fitAddon.fit();
        sendSizeRef.current?.();
      } catch (e) {
        console.error("Terminal open error:", e);
      }
    }, 10);

    const sendSize = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN && term.cols && term.rows) {
        if (term.cols !== lastDimensions.cols || term.rows !== lastDimensions.rows) {
          lastDimensions.cols = term.cols;
          lastDimensions.rows = term.rows;
          wsRef.current.send(`\0DEVPILOT_RESIZE:${term.cols}:${term.rows}`);
        }
      }
    };
    sendSizeRef.current = sendSize;

    const handleResize = () => {
      if (!disposed && terminalElement.offsetParent) {
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
          if (disposed || !terminalElement.offsetParent) return;
          try {
            fitAddon.fit();
            sendSize();
          } catch {}
        });
      }
    };
    window.addEventListener("resize", handleResize);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(terminalElement);

    const connect = async () => {
      try {
        const backendUrl = await getBackendUrl();
        if (disposed) return;
        const wsUrl = new URL("/ws/terminal", backendUrl);
        wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
        if (repository?.root_path) wsUrl.searchParams.set("cwd", repository.root_path);
        if (term.cols) wsUrl.searchParams.set("cols", String(term.cols));
        if (term.rows) wsUrl.searchParams.set("rows", String(term.rows));

        isExitedRef.current = false;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          handleResize();
        };

        ws.onmessage = (event) => {
          term.write(event.data);
        };

        ws.onerror = () => {
          term.writeln("\r\n\x1b[1;31mTerminal backend is not ready.\x1b[0m");
        };

        ws.onclose = (event) => {
          if (disposed) return;
          if (event.code === 1000) {
            // Normal process exit (e.g. typed exit)
            isExitedRef.current = true;
            term.writeln("\r\n\x1b[1;30m[Process exited - Press Enter or click Restart to launch a new session]\x1b[0m\r\n");
          } else {
            term.writeln("\r\n\x1b[1;33mTerminal disconnected. Reconnecting...\x1b[0m");
            reconnectTimer = setTimeout(connect, 2000);
          }
        };
      } catch (error) {
        term.writeln(`\r\n\x1b[1;31mCould not start terminal: ${String(error)}\x1b[0m`);
      }
    };

    restartRef.current = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000);
      }
      term.clear?.();
      void connect();
    };

    void connect();

    const dataDisposable = term.onData((data) => {
      if (isExitedRef.current) {
        // If process exited and user hits Enter, restart session
        if (data === "\r" || data === "\n") {
          restartRef.current?.();
        }
        return;
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data);
      }
    });

    let lastPastedText = "";
    let lastPastedTime = 0;

    const handlePaste = (text: string) => {
      if (!text) return;
      const now = Date.now();
      if (text === lastPastedText && now - lastPastedTime < 350) {
        return;
      }
      lastPastedText = text;
      lastPastedTime = now;
      if (typeof term.paste === "function") {
        term.paste(text);
      } else if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(text);
      }
    };
    handlePasteRef.current = handlePaste;

    term.attachCustomKeyEventHandler?.((event: KeyboardEvent) => {
      if (event.type !== "keydown") return true;

      const key = event.key.toLowerCase();

      // Copy:
      // Ctrl+C with text selected -> Copy
      // Ctrl+Shift+C (Linux standard) / Cmd+C (macOS) / Ctrl+Insert
      const isCopyKey =
        (key === "c" && (event.ctrlKey || (isMac && event.metaKey))) ||
        (key === "insert" && event.ctrlKey && !event.shiftKey);

      if (isCopyKey) {
        const hasSelection = Boolean(term.hasSelection?.() || term.getSelection?.());
        const isCopy =
          (key === "c" && hasSelection && event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) ||
          (key === "c" && (isMac ? event.metaKey : event.ctrlKey && event.shiftKey)) ||
          (key === "insert" && event.ctrlKey && !event.shiftKey);

        if (isCopy) {
          event.preventDefault?.();
          event.stopPropagation?.();
          const selection = term.getSelection?.();
          if (selection) void writeClipboardText(selection);
          term.clearSelection?.();
          return false; // Prevent sending SIGINT on first copy
        }
      }

      // Paste:
      // Ctrl+V (web & desktop standard)
      // Ctrl+Shift+V (Linux terminal standard)
      // Cmd+V (macOS) / Shift+Insert
      const isPaste =
        (key === "v" && ((event.ctrlKey && !event.altKey) || (isMac && event.metaKey))) ||
        (key === "insert" && event.shiftKey && !event.ctrlKey);

      if (isPaste) {
        event.preventDefault?.();
        event.stopPropagation?.();
        void readClipboardText().then((text) => {
          if (text) {
            handlePaste(text);
          }
        });
        return false;
      }

      // Clear Buffer:
      // Ctrl+K (macOS & modern terminals)
      const isClear = key === "k" && (isMac ? event.metaKey : event.ctrlKey && !event.shiftKey);
      if (isClear) {
        event.preventDefault?.();
        event.stopPropagation?.();
        term.clear?.();
        return false;
      }

      // Select All:
      // Ctrl+Shift+A or Cmd+A (macOS)
      const isSelectAll = (key === "a" && (isMac ? event.metaKey : event.ctrlKey && event.shiftKey));
      if (isSelectAll) {
        event.preventDefault?.();
        event.stopPropagation?.();
        term.selectAll?.();
        return false;
      }

      return true;
    });

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      const hasSelection = Boolean(term.hasSelection?.() || term.getSelection?.());
      setContextMenu({
        x: Math.min(event.clientX, window.innerWidth - 210),
        y: Math.min(event.clientY, window.innerHeight - 220),
        hasSelection,
      });
    };
    terminalElement.addEventListener("contextmenu", handleContextMenu);

    return () => {
      disposed = true;
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      terminalElement.removeEventListener("contextmenu", handleContextMenu);
      dataDisposable.dispose();
      wsRef.current?.close();
      fitAddonRef.current = null;
      termRef.current = null;
      fitAddon.dispose();
      term.dispose();
    };
  }, [repository?.root_path]);

  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
        sendSizeRef.current?.();
        termRef.current?.focus?.();
      } catch {}
    }, 50);
    return () => clearTimeout(timer);
  }, [isActive]);

  const handleCopyMenu = () => {
    const text = termRef.current?.getSelection?.();
    if (text) void writeClipboardText(text);
    setContextMenu(null);
  };

  const handlePasteMenu = () => {
    void readClipboardText().then((text) => {
      if (text) {
        handlePasteRef.current(text);
      }
    });
    setContextMenu(null);
  };

  const handleSelectAllMenu = () => {
    termRef.current?.selectAll?.();
    setContextMenu(null);
  };

  const handleClearMenu = () => {
    termRef.current?.clear?.();
    setContextMenu(null);
  };

  const handleRestartMenu = () => {
    restart();
    setContextMenu(null);
  };

  return (
    <div
      ref={terminalRef}
      onClick={() => termRef.current?.focus?.()}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
            background: "#18181b",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "8px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6)",
            padding: "5px",
            minWidth: "190px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={!contextMenu.hasSelection}
            onClick={handleCopyMenu}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 10px",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              color: contextMenu.hasSelection ? "#e4e4e7" : "#52525b",
              fontSize: "12px",
              cursor: contextMenu.hasSelection ? "pointer" : "default",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              if (contextMenu.hasSelection) e.currentTarget.style.background = "rgba(139,92,246,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Copy size={13} /> Copy
            </span>
            <span style={{ fontSize: "10px", color: "#71717a" }}>{isMac ? "⌘C" : "Ctrl+Shift+C"}</span>
          </button>

          <button
            type="button"
            onClick={handlePasteMenu}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 10px",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              color: "#e4e4e7",
              fontSize: "12px",
              cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ClipboardPaste size={13} /> Paste
            </span>
            <span style={{ fontSize: "10px", color: "#71717a" }}>{isMac ? "⌘V" : "Ctrl+V"}</span>
          </button>

          <button
            type="button"
            onClick={handleSelectAllMenu}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 10px",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              color: "#e4e4e7",
              fontSize: "12px",
              cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span>Select All</span>
            <span style={{ fontSize: "10px", color: "#71717a" }}>{isMac ? "⌘A" : "Ctrl+Shift+A"}</span>
          </button>

          <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "3px 0" }} />

          <button
            type="button"
            onClick={handleClearMenu}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 10px",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              color: "#e4e4e7",
              fontSize: "12px",
              cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Trash2 size={13} /> Clear
            </span>
            <span style={{ fontSize: "10px", color: "#71717a" }}>{isMac ? "⌘K" : "Ctrl+K"}</span>
          </button>

          <button
            type="button"
            onClick={handleRestartMenu}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 10px",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              color: "#e4e4e7",
              fontSize: "12px",
              cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <RotateCw size={13} /> Restart Session
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export function TerminalPage({ repository, isActive = true }: { repository: RepositoryInfo | null; isActive?: boolean }) {
  const nextPaneId = useRef(2);
  const nextTabId = useRef(2);

  interface TabData {
    id: number;
    title?: string;
    panes: TerminalPane[];
    activePaneId: number;
  }

  const [tabs, setTabs] = useState<TabData[]>([{ id: 1, panes: [{ id: 1 }], activePaneId: 1 }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [editingTabId, setEditingTabId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const sessionActionsRef = useRef<Record<number, { clear?: () => void; restart?: () => void }>>({});

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

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const addTab = () => {
    const tId = nextTabId.current++;
    const pId = nextPaneId.current++;
    setTabs((current) => [...current, { id: tId, panes: [{ id: pId }], activePaneId: pId }]);
    setActiveTabId(tId);
  };

  const closeTab = (id: number) => {
    if (tabs.length === 1) return;
    const index = tabs.findIndex((t) => t.id === id);
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (id === activeTabId) setActiveTabId(remaining[Math.max(0, index - 1)].id);
  };

  const saveTabTitle = (tabId: number) => {
    const trimmed = editingTitle.trim();
    setTabs((current) => current.map((t) => (t.id === tabId ? { ...t, title: trimmed || undefined } : t)));
    setEditingTabId(null);
  };

  const addSplit = (tabId: number) => {
    const pId = nextPaneId.current++;
    setTabs((current) =>
      current.map((t) => {
        if (t.id === tabId) {
          return { ...t, panes: [...t.panes, { id: pId }], activePaneId: pId };
        }
        return t;
      })
    );
  };

  const closeSplit = (tabId: number, paneId: number) => {
    delete sessionActionsRef.current[paneId];
    setTabs((current) =>
      current.map((t) => {
        if (t.id === tabId) {
          if (t.panes.length === 1) return t;
          const index = t.panes.findIndex((p) => p.id === paneId);
          const remaining = t.panes.filter((p) => p.id !== paneId);
          return {
            ...t,
            panes: remaining,
            activePaneId: t.activePaneId === paneId ? remaining[Math.max(0, index - 1)].id : t.activePaneId,
          };
        }
        return t;
      })
    );
  };

  const setActivePane = (tabId: number, paneId: number) => {
    setTabs((current) => current.map((t) => (t.id === tabId ? { ...t, activePaneId: paneId } : t)));
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
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "16px",
        background: "var(--background)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          minHeight: "40px",
          marginBottom: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", overflowX: "auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "7px",
              background: "rgba(167,139,250,0.14)",
              color: "#c4b5fd",
              marginRight: "4px",
              flexShrink: 0,
            }}
          >
            <SquareTerminal size={15} />
          </div>
          {tabs.map((tab, idx) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={() => {
                setEditingTabId(tab.id);
                setEditingTitle(tab.title || `Tab ${idx + 1}`);
              }}
              title="Double click to rename"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 13px",
                background: activeTabId === tab.id ? "rgba(167,139,250,0.14)" : "rgba(255,255,255,0.03)",
                border: activeTabId === tab.id ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.06)",
                borderRadius: "7px",
                cursor: "pointer",
                color: activeTabId === tab.id ? "#ddd6fe" : "var(--muted-foreground)",
                fontSize: "12px",
                fontWeight: 600,
                userSelect: "none",
                transition: "all 0.15s ease",
                boxShadow: activeTabId === tab.id ? "0 2px 8px -2px rgba(167,139,250,0.25)" : "none",
              }}
            >
              {editingTabId === tab.id ? (
                <input
                  type="text"
                  autoFocus
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => saveTabTitle(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTabTitle(tab.id);
                    if (e.key === "Escape") setEditingTabId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: "rgba(0,0,0,0.6)",
                    border: "1px solid #a78bfa",
                    borderRadius: "4px",
                    color: "#fff",
                    padding: "1px 5px",
                    fontSize: "11px",
                    width: "80px",
                    outline: "none",
                  }}
                />
              ) : (
                <span>{tab.title || `Tab ${idx + 1}`}</span>
              )}
              {tabs.length > 1 && (
                <X
                  size={12}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  style={{ opacity: 0.65, cursor: "pointer", transition: "opacity 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
                />
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit full screen" : "Toggle full screen"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.04)",
              color: "var(--muted-foreground)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "var(--foreground)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = "var(--muted-foreground)";
            }}
          >
            {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
          <button
            type="button"
            onClick={addTab}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              height: "32px",
              padding: "0 13px",
              border: "1px solid rgba(167,139,250,0.35)",
              borderRadius: "8px",
              background: "rgba(167,139,250,0.12)",
              color: "#c4b5fd",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: "12px",
              fontWeight: 600,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(167,139,250,0.2)";
              e.currentTarget.style.borderColor = "rgba(167,139,250,0.55)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(167,139,250,0.12)";
              e.currentTarget.style.borderColor = "rgba(167,139,250,0.35)";
            }}
          >
            <Plus size={15} />
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
              gap: "8px",
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
                  borderRadius: "10px",
                  background: "#0c0d12",
                  border:
                    tab.activePaneId === pane.id
                      ? "1px solid rgba(167,139,250,0.5)"
                      : "1px solid rgba(255,255,255,0.08)",
                  boxShadow:
                    tab.activePaneId === pane.id
                      ? "0 0 16px -4px rgba(167,139,250,0.18)"
                      : "none",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  ...(tab.panes.length === 3 && index === 0 ? { gridRow: "1 / span 2" } : {}),
                }}
              >
                <div
                  style={{
                    height: "34px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 10px 0 12px",
                    background:
                      tab.activePaneId === pane.id
                        ? "linear-gradient(90deg, rgba(167,139,250,0.12) 0%, rgba(167,139,250,0.03) 100%)"
                        : "rgba(255,255,255,0.02)",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "2px 7px",
                        borderRadius: "5px",
                        background: tab.activePaneId === pane.id ? "rgba(167,139,250,0.15)" : "transparent",
                      }}
                    >
                      <SquareTerminal
                        size={13}
                        color={tab.activePaneId === pane.id ? "#c4b5fd" : "#71717a"}
                      />
                      <span
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 600,
                          letterSpacing: "0.2px",
                          color: tab.activePaneId === pane.id ? "#f5f3ff" : "#a1a1aa",
                        }}
                      >
                        Terminal {index + 1}
                      </span>
                      {tab.activePaneId === pane.id && (
                        <span
                          style={{
                            width: "5px",
                            height: "5px",
                            borderRadius: "50%",
                            background: "#34d399",
                            boxShadow: "0 0 6px #34d399",
                            marginLeft: "3px",
                          }}
                        />
                      )}
                    </div>
                    {/* Repository context: name + branch */}
                    {repository && (
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", opacity: 0.65 }}>
                        <span style={{ fontSize: "10.5px", color: "#a1a1aa" }}>
                          {repository.name}
                        </span>
                        {repository.current_branch && (
                          <>
                            <span style={{ color: "#52525b", fontSize: "10px" }}>›</span>
                            <GitBranch size={10} color="#a78bfa" />
                            <span style={{ fontSize: "10.5px", color: "#c4b5fd", fontWeight: 600 }}>
                              {repository.current_branch}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        sessionActionsRef.current[pane.id]?.clear?.();
                      }}
                      title="Clear terminal buffer (Ctrl+K)"
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: "24px",
                        height: "24px",
                        padding: 0,
                        border: "1px solid transparent",
                        borderRadius: "5px",
                        background: "transparent",
                        color: "#a1a1aa",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                        e.currentTarget.style.color = "#f4f4f5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#a1a1aa";
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        sessionActionsRef.current[pane.id]?.restart?.();
                      }}
                      title="Restart terminal session"
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: "24px",
                        height: "24px",
                        padding: 0,
                        border: "1px solid transparent",
                        borderRadius: "5px",
                        background: "transparent",
                        color: "#a1a1aa",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                        e.currentTarget.style.color = "#f4f4f5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#a1a1aa";
                      }}
                    >
                      <RotateCw size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addSplit(tab.id);
                      }}
                      title="Split terminal (add side-by-side pane)"
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: "24px",
                        height: "24px",
                        padding: 0,
                        border: "1px solid transparent",
                        borderRadius: "5px",
                        background: "transparent",
                        color: "#a1a1aa",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                        e.currentTarget.style.color = "#f4f4f5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#a1a1aa";
                      }}
                    >
                      <PanelsLeftRight size={13} />
                    </button>
                    {tab.panes.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeSplit(tab.id, pane.id);
                        }}
                        title="Close pane"
                        style={{
                          display: "grid",
                          placeItems: "center",
                          width: "24px",
                          height: "24px",
                          padding: 0,
                          border: "1px solid transparent",
                          borderRadius: "5px",
                          background: "transparent",
                          color: "#a1a1aa",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(239,68,68,0.18)";
                          e.currentTarget.style.color = "#fca5a5";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "#a1a1aa";
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                  <div style={{ position: "absolute", inset: "8px 12px" }}>
                    <TerminalSession
                      repository={repository}
                      isActive={isActive && tab.activePaneId === pane.id && activeTabId === tab.id}
                      onRegisterActions={(actions) => {
                        sessionActionsRef.current[pane.id] = actions;
                      }}
                    />
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

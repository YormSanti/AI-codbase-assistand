import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";
import { Terminal, Maximize2, RotateCcw, Shield } from "lucide-react";

export function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
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
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    // Initial greeting
    term.writeln("\x1b[1;35mDevPilot AI Terminal emulator initialized.\x1b[0m");
    term.writeln("\x1b[38;5;244mThis is a client-side shell. Real PTY execution requires the backend WebSocket module.\x1b[0m");
    term.writeln("");
    
    let currentLine = "";
    const prompt = () => {
      term.write("\x1b[1;32mdevpilot\x1b[0m@\x1b[1;34mworkspace\x1b[0m:~$ ");
    };

    prompt();

    term.onKey(({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

      if (domEvent.keyCode === 13) {
        // Enter
        term.write("\r\n");
        const command = currentLine.trim();
        if (command) {
          if (command === "clear") {
            term.clear();
          } else if (command === "whoami") {
            term.writeln("devpilot-user");
          } else if (command === "pwd") {
            term.writeln("/home/workspace");
          } else if (command === "ls") {
            term.writeln("\x1b[1;34msrc\x1b[0m  \x1b[1;34mpublic\x1b[0m  package.json  vite.config.ts  README.md");
          } else if (command.startsWith("echo ")) {
            term.writeln(command.substring(5));
          } else {
            term.writeln(`bash: ${command}: command not found`);
          }
        }
        currentLine = "";
        prompt();
      } else if (domEvent.keyCode === 8) {
        // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          term.write("\b \b");
        }
      } else if (printable) {
        currentLine += key;
        term.write(key);
      }
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
    };
  }, []);

  // Ensure terminal resizes correctly when container size changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fitAddonRef.current?.fit();
    }, 100);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const restartTerminal = () => {
    const term = xtermRef.current;
    if (term) {
      term.clear();
      term.writeln("\x1b[1;35mTerminal session restarted.\x1b[0m");
      term.writeln("");
      term.write("\x1b[1;32mdevpilot\x1b[0m@\x1b[1;34mworkspace\x1b[0m:~$ ");
    }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "20px",
      width: "100%", height: isFullscreen ? "100vh" : "100%",
      position: isFullscreen ? "fixed" : "relative",
      top: isFullscreen ? 0 : "auto", left: isFullscreen ? 0 : "auto",
      zIndex: isFullscreen ? 1000 : 1,
      padding: isFullscreen ? "20px" : "20px",
      background: "var(--background)",
      boxSizing: "border-box",
    }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px", borderRadius: "20px",
        background: "rgba(18,18,24,0.9)",
        border: "1.5px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 32px -8px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            padding: "10px", borderRadius: "12px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)"
          }}>
            <Terminal style={{ width: "20px", height: "20px", color: "#a78bfa" }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--foreground)" }}>Integrated Terminal</h2>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted-foreground)" }}>Client-side shell emulation</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "99px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(52,211,153,0.3)" }}>
            <Shield style={{ width: "12px", height: "12px", color: "#34d399" }} />
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#34d399" }}>Local Session</span>
          </div>

          <button
            onClick={restartTerminal}
            style={{
              padding: "8px", borderRadius: "10px", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)", color: "var(--muted-foreground)",
              cursor: "pointer", transition: "all 0.2s"
            }}
            title="Restart Terminal"
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
          >
            <RotateCcw style={{ width: "16px", height: "16px" }} />
          </button>
          
          <button
            onClick={toggleFullscreen}
            style={{
              padding: "8px", borderRadius: "10px", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)", color: "var(--muted-foreground)",
              cursor: "pointer", transition: "all 0.2s"
            }}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
          >
            <Maximize2 style={{ width: "16px", height: "16px" }} />
          </button>
        </div>
      </div>

      {/* ── Terminal Window ─────────────────────────────────────────────── */}
      <div style={{
        flex: 1, borderRadius: "20px", overflow: "hidden",
        background: "#0a0a0e",
        border: "1.5px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 32px -8px rgba(0,0,0,0.6)",
        padding: "16px",
        display: "flex", flexDirection: "column",
      }}>
        <div ref={terminalRef} style={{ flex: 1, width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}

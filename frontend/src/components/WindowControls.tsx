import { Minus, Square, X } from "lucide-react";

// The desktop window runs without native decorations, so the app headers
// provide the minimize / maximize / close buttons. Outside Tauri (browser
// dev server, tests) there is no native window to control.
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function withWindow(action: "minimize" | "toggleMaximize" | "close") {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  // close() still emits close-requested, so the unsaved-draft guards run.
  await getCurrentWindow()[action]();
}

export function WindowControls() {
  if (!isTauri) return null;

  return (
    <div className="ifrog-window-controls">
      <button type="button" className="ifrog-window-control" aria-label="Minimize window" title="Minimize" onClick={() => void withWindow("minimize")}>
        <Minus size={14} />
      </button>
      <button type="button" className="ifrog-window-control" aria-label="Maximize window" title="Maximize" onClick={() => void withWindow("toggleMaximize")}>
        <Square size={12} />
      </button>
      <button type="button" className="ifrog-window-control ifrog-window-control-close" aria-label="Close window" title="Close" onClick={() => void withWindow("close")}>
        <X size={15} />
      </button>
    </div>
  );
}

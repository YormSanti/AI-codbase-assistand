import { useEffect, useRef } from "react";

export interface EditorStatus { dirty: boolean; saving: boolean }

export function useWorkspaceCloseGuard(status: EditorStatus) {
  const current = useRef(status);
  current.current = status;

  useEffect(() => {
    if (!status.dirty && !status.saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [status.dirty, status.saving]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let active = true;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => getCurrentWindow().onCloseRequested(event => {
        if (!active) return;
        if (current.current.saving || (current.current.dirty && !window.confirm("Discard unsaved changes in your open files and close IFROG?"))) event.preventDefault();
      }))
      .then(stopListening => { if (active) unlisten = stopListening; else stopListening(); })
      .catch(error => console.error("Could not register the workspace close guard", error));
    return () => { active = false; unlisten?.(); };
  }, []);
}

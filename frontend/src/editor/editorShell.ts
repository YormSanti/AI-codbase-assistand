import { createContext, useContext } from "react";

/** Actions the code editor shell offers to the documents inside it; null outside the active editor. */
export interface EditorShell {
  showFileHistory: (path: string) => void;
}

export const EditorShellContext = createContext<EditorShell | null>(null);

export function useEditorShell(): EditorShell | null {
  return useContext(EditorShellContext);
}

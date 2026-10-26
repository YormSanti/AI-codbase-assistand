export type EditorCommand =
  | "openFolder" | "openFile" | "save" | "saveAll" | "closeFile"
  | "undo" | "redo" | "find" | "goToLine" | "selectAll"
  | "toggleExplorer" | "showExplorer" | "hideExplorer" | "toggleOutline" | "toggleWordWrap" | "toggleMinimap" | "refreshFiles"
  | "previousFile" | "nextFile";

/** Tool views the editor shell can be asked to open when it becomes active. */
export type EditorToolView = "search" | "git" | "ai";

export interface EditorWorkspaceHandle {
  runCommand: (command: EditorCommand) => void;
  /** Open `path` in the workspace and place the cursor on `line` once it has loaded. */
  revealLine: (path: string, line: number) => void;
}

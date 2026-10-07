export type EditorCommand =
  | "openFolder" | "openFile" | "save" | "saveAll" | "closeFile"
  | "undo" | "redo" | "find" | "goToLine" | "selectAll"
  | "toggleExplorer" | "toggleOutline" | "toggleWordWrap" | "toggleMinimap" | "refreshFiles"
  | "previousFile" | "nextFile";

export interface EditorWorkspaceHandle {
  runCommand: (command: EditorCommand) => void;
}

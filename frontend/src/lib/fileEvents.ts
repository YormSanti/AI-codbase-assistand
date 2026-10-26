/** Announced after IFROG itself rewrites files on disk (for example Discard in Source Control). */
export const FILES_CHANGED_EVENT = "ifrog:files-changed-on-disk";

export interface FilesChangedDetail {
  /** Repository-relative paths as Git reports them; "*" means any file may have changed (a branch switch). */
  paths: string[];
}

export function announceFilesChanged(paths: string[]): void {
  window.dispatchEvent(new CustomEvent<FilesChangedDetail>(FILES_CHANGED_EVENT, { detail: { paths } }));
}

/**
 * Git paths are relative to the repository root, editor paths to the opened
 * folder, which may be a subfolder; match either exactly or by path suffix.
 */
export function affectsPath(changed: string[], editorPath: string): boolean {
  return changed.some(path => path === "*" || path === editorPath || path.endsWith(`/${editorPath}`));
}

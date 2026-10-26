/** Copy text with the desktop clipboard plugin when available, else the browser API. */
export async function copyText(text: string): Promise<void> {
  if ("__TAURI_INTERNALS__" in window) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}

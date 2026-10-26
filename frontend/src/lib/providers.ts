export type ProviderId = "codex" | "gemini";

export interface ProviderStatus {
  installed: boolean;
  authenticated: boolean;
}

export const PROVIDER_NAMES: Record<ProviderId, string> = { codex: "Codex", gemini: "Gemini" };

/** Login state of the CLI providers; null outside the desktop app, where they cannot run. */
export async function getProviderStatuses(): Promise<Record<ProviderId, ProviderStatus> | null> {
  if (!("__TAURI_INTERNALS__" in window)) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  const [codex, gemini] = await Promise.all([
    invoke<ProviderStatus>("codex_login_status"),
    invoke<ProviderStatus>("gemini_login_status"),
  ]);
  return { codex, gemini };
}

export function describeProvider(status: ProviderStatus | undefined): { label: string; tone: "ok" | "warn" | "muted" } {
  if (!status) return { label: "Unknown", tone: "muted" };
  if (!status.installed) return { label: "Not installed", tone: "muted" };
  if (!status.authenticated) return { label: "Not signed in", tone: "warn" };
  return { label: "Connected", tone: "ok" };
}

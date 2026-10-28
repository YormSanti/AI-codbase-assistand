import { apiRequest } from "../api/client";

/** CLI providers, in the order pickers list them. */
export const PROVIDER_IDS = ["gemini", "codex", "claude"] as const;
export type ProviderId = typeof PROVIDER_IDS[number];

export interface ProviderStatus {
  installed: boolean;
  authenticated: boolean;
}

export const PROVIDER_NAMES: Record<ProviderId, string> = { codex: "Codex", gemini: "Gemini", claude: "Claude" };

export function isProviderId(value: unknown): value is ProviderId {
  return PROVIDER_IDS.includes(value as ProviderId);
}

/** The provider shown under this display name in the composer, Gemini when unknown. */
export function providerFromName(name: string): ProviderId {
  return PROVIDER_IDS.find(id => PROVIDER_NAMES[id] === name) ?? "gemini";
}

/** Login state of the CLI providers, from the desktop shell or, in the browser, the local backend. */
export async function getProviderStatuses(): Promise<Record<ProviderId, ProviderStatus> | null> {
  if (!("__TAURI_INTERNALS__" in window)) return apiRequest<Record<ProviderId, ProviderStatus>>("/api/agent/providers");
  const { invoke } = await import("@tauri-apps/api/core");
  const statuses = await Promise.all(PROVIDER_IDS.map(id => invoke<ProviderStatus>(`${id}_login_status`)));
  return Object.fromEntries(PROVIDER_IDS.map((id, index) => [id, statuses[index]])) as Record<ProviderId, ProviderStatus>;
}

export function describeProvider(status: ProviderStatus | undefined): { label: string; tone: "ok" | "warn" | "muted" } {
  if (!status) return { label: "Unknown", tone: "muted" };
  if (!status.installed) return { label: "Not installed", tone: "muted" };
  if (!status.authenticated) return { label: "Not signed in", tone: "warn" };
  return { label: "Connected", tone: "ok" };
}

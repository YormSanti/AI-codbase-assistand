export async function getBackendUrl(): Promise<string> {
  if ("__TAURI_INTERNALS__" in window) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("backend_url");
  }

  return import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const READINESS_TIMEOUT_MS = 30_000;
const INITIAL_RETRY_DELAY_MS = 150;
const MAX_RETRY_DELAY_MS = 1_000;

let backendReady: Promise<void> | null = null;

function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function waitForBackend(baseUrl: string): Promise<void> {
  const deadline = Date.now() + READINESS_TIMEOUT_MS;
  let delay = INITIAL_RETRY_DELAY_MS;
  for (;;) {
    try {
      const response = await fetch(`${baseUrl}/health`, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // The sidecar is still binding its port; keep waiting.
    }
    if (Date.now() >= deadline) return; // Give up quietly; the real request reports the error.
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
  }
}

/**
 * In the desktop app the Python sidecar starts alongside the window, so the
 * first requests can race its startup. Wait once for /health before the first
 * API call; the browser build talks to an already running server and skips this.
 */
export function ensureBackendReady(): Promise<void> {
  if (!isDesktop()) return Promise.resolve();
  backendReady ??= getBackendUrl().then(waitForBackend).catch(() => undefined);
  return backendReady;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  await ensureBackendReady();
  const backendUrl = await getBackendUrl();
  const response = await fetch(`${backendUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, body.detail ?? response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

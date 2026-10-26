import { afterEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe("apiRequest readiness", () => {
  it("waits for the desktop sidecar health check before the first request", async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    invoke.mockResolvedValue("http://127.0.0.1:4321");
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "ok" }) });
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await import("./client");

    const result = await apiRequest<{ status: string }>("/health");

    expect(result).toEqual({ status: "ok" });
    const urls = fetchMock.mock.calls.map(call => String(call[0]));
    expect(urls.slice(0, 3)).toEqual(Array(3).fill("http://127.0.0.1:4321/health"));
    expect(urls).toHaveLength(4);

    // Readiness is checked once per session, not per request.
    await apiRequest("/health");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("does not probe health in the browser build", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await import("./client");

    await apiRequest("/api/repositories");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/repositories");
  });
});

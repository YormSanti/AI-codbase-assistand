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

describe("apiRequest errors and headers", () => {
  const failure = (status: number, body: unknown, statusText = "") =>
    vi.fn().mockResolvedValue({ ok: false, status, statusText, json: async () => body });

  it("joins validation error messages instead of showing [object Object]", async () => {
    vi.stubGlobal("fetch", failure(422, { detail: [{ loc: ["body", "path"], msg: "Field required" }, { msg: "Too long" }] }));
    const { apiRequest, ApiError } = await import("./client");

    const error = await apiRequest("/api/repositories/open", { method: "POST" }).catch(caught => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, message: "Field required; Too long" });
  });

  it("uses the string detail, then the status text, then the status code", async () => {
    vi.stubGlobal("fetch", failure(404, { detail: "No repository with id=9" }));
    let { apiRequest } = await import("./client");
    await expect(apiRequest("/api/repositories/9")).rejects.toMatchObject({ message: "No repository with id=9" });

    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, statusText: "Bad Gateway", json: async () => { throw new SyntaxError("not json"); } }));
    ({ apiRequest } = await import("./client"));
    await expect(apiRequest("/api/repositories")).rejects.toMatchObject({ status: 502, message: "Bad Gateway" });

    vi.resetModules();
    vi.stubGlobal("fetch", failure(500, {}));
    ({ apiRequest } = await import("./client"));
    await expect(apiRequest("/api/repositories")).rejects.toMatchObject({ message: "Request failed (500)." });
  });

  it("keeps the JSON content type when the caller passes its own headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await import("./client");

    await apiRequest("/api/repositories/open", { method: "POST", body: "{}", headers: { "X-Trace": "1" } });

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Trace")).toBe("1");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
});

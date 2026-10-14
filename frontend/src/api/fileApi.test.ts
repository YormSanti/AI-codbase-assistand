import { afterEach, describe, expect, it, vi } from "vitest";
import { fileApi } from "./fileApi";

describe("fileApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads content for an indexed file", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ file_id: 7, path: "src/app.ts", content: "export {};", is_binary: false, truncated: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fileApi.getContent(7);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/files/7/content"),
      expect.any(Object),
    );
  });

  it("loads the symbol outline", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    await fileApi.getSymbols(7);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/files/7/symbols"),
      expect.any(Object),
    );
  });

  it("sends edited content and the loaded version when saving", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ file_id: 7 }) });
    vi.stubGlobal("fetch", fetchMock);
    await fileApi.saveContent(7, "export const edited = true;\n", "a".repeat(64));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/files/7/content"),
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ content: "export const edited = true;\n", expected_hash: "a".repeat(64) }) }),
    );
  });
});

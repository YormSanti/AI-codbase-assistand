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
});

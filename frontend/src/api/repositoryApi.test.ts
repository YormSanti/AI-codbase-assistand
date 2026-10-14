import { afterEach, describe, expect, it, vi } from "vitest";
import { repositoryApi } from "./repositoryApi";
import { ApiError } from "./client";

describe("repositoryApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the path when opening a repository", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, name: "repo", root_path: "/repo", current_branch: "main", head_commit: null, opened_at: null, file_count: 3 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await repositoryApi.open("/repo");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/repositories/open"),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ path: "/repo" }) }),
    );
    expect(result.name).toBe("repo");
  });

  it("throws ApiError with the server-provided detail on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ detail: "'/tmp' is not a Git repository" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(repositoryApi.open("/tmp")).rejects.toThrow(ApiError);
    await expect(repositoryApi.open("/tmp")).rejects.toThrow("is not a Git repository");
  });

  it("deletes an indexed repository", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    await repositoryApi.remove(3);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/repositories/3"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("shares concurrent opens of the same project and permits later refreshes", async () => {
    let finish!: (value: unknown) => void;
    const response = { ok: true, json: async () => ({ id: 1, name: "repo" }) };
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    const first = repositoryApi.open("/same-project");
    const second = repositoryApi.open("/same-project");
    expect(second).toBe(first);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    finish(response);
    expect(await first).toEqual(await second);
    await repositoryApi.open("/same-project");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears failed pending opens so a retry can succeed", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Connection failed")).mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    const first = repositoryApi.open("/retry-project");
    const second = repositoryApi.open("/retry-project");
    await expect(first).rejects.toThrow("Connection failed");
    await expect(second).rejects.toThrow("Connection failed");
    await expect(repositoryApi.open("/retry-project")).resolves.toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

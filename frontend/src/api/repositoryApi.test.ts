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
});

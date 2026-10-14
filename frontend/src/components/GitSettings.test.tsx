import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { gitApi } from "../api/gitApi";
import { updateSettings } from "../hooks/useAppSettings";
import { GitPage } from "./GitPage";

vi.mock("../api/gitApi", () => ({ gitApi: { getStatus: vi.fn(), getDiff: vi.fn() } }));
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); vi.useFakeTimers();
  vi.mocked(gitApi.getStatus).mockImplementation(async () => ({ branch: "main", head_commit: null, upstream: null, ahead: null, behind: null, remote_url: null, changes: [], commits: [] }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });

it("does not start live Git review polling on the restored original dashboard", async () => {
  updateSettings({ gitRefreshInterval: 60 });
  render(<GitPage repository={{ id: 1, name: "repo", root_path: "/repo", current_branch: "main", head_commit: null, opened_at: null, file_count: 0 }} onNavigate={vi.fn()} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(59_000); });
  expect(gitApi.getStatus).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
  expect(gitApi.getStatus).not.toHaveBeenCalled();
  act(() => updateSettings({ gitRefreshInterval: 0 }));
  fireEvent(window, new Event("focus"));
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(gitApi.getStatus).not.toHaveBeenCalled();
  expect(gitApi.getDiff).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
});

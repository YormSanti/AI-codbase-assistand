import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { gitApi } from "../api/gitApi";
import { updateSettings } from "../hooks/useAppSettings";
import { GitPage } from "./GitPage";

vi.mock("../api/gitApi", () => ({ gitApi: { getStatus: vi.fn(), getDiff: vi.fn() } }));
const repository = { id: 1, name: "repo", root_path: "/repo", current_branch: "main", head_commit: null, opened_at: null, file_count: 0 };

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); vi.useFakeTimers();
  vi.mocked(gitApi.getStatus).mockImplementation(async () => ({ branch: "main", head_commit: null, upstream: null, ahead: null, behind: null, remote_url: null, changes: [], commits: [] }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });

it("refreshes Git status on the interval chosen in Settings and stops when set to manual", async () => {
  updateSettings({ gitRefreshInterval: 60 });
  render(<GitPage repository={repository} onNavigate={vi.fn()} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(gitApi.getStatus).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Working tree clean")).toBeInTheDocument();

  await act(async () => { await vi.advanceTimersByTimeAsync(59_000); });
  expect(gitApi.getStatus).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
  expect(gitApi.getStatus).toHaveBeenCalledTimes(2);

  act(() => updateSettings({ gitRefreshInterval: 0 }));
  await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
  expect(gitApi.getStatus).toHaveBeenCalledTimes(2);

  fireEvent(window, new Event("focus"));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(gitApi.getStatus).toHaveBeenCalledTimes(3);
  expect(gitApi.getDiff).not.toHaveBeenCalled();
});

it("refreshes on demand from the toolbar", async () => {
  updateSettings({ gitRefreshInterval: 0 });
  render(<GitPage repository={repository} onNavigate={vi.fn()} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  fireEvent.click(screen.getByRole("button", { name: "Refresh Git status" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(gitApi.getStatus).toHaveBeenCalledTimes(2);
});

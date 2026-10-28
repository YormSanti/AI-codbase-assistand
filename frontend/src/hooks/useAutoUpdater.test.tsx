import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { updateSettings } from "./useAppSettings";
import { useAutoUpdater } from "./useAutoUpdater";

const { check } = vi.hoisted(() => ({ check: vi.fn().mockResolvedValue(null) }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check }));
const { relaunch, toast } = vi.hoisted(() => ({
  relaunch: vi.fn(),
  toast: { info: vi.fn(), loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch }));
vi.mock("sonner", () => ({ toast }));

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); Reflect.deleteProperty(window, "__TAURI_INTERNALS__"); });

it("does not call desktop updater tools in a browser", async () => {
  renderHook(() => useAutoUpdater());
  await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
  expect(check).not.toHaveBeenCalled();
});

it("checks for desktop updates when enabled and cancels a pending check when disabled", async () => {
  Object.assign(window, { __TAURI_INTERNALS__: {} });
  const view = renderHook(() => useAutoUpdater());
  act(() => updateSettings({ checkUpdatesOnStartup: false }));
  await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
  expect(check).not.toHaveBeenCalled();
  act(() => updateSettings({ checkUpdatesOnStartup: true }));
  await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
  expect(check).toHaveBeenCalledTimes(1);
  view.unmount();
});

it("announces an available update in the app and installs it from the toast action", async () => {
  Object.assign(window, { __TAURI_INTERNALS__: {} });
  const downloadAndInstall = vi.fn(async (onEvent: (event: unknown) => void) => {
    onEvent({ event: "Started", data: { contentLength: 200 } });
    onEvent({ event: "Progress", data: { chunkLength: 100 } });
    onEvent({ event: "Finished" });
  });
  check.mockResolvedValueOnce({ version: "1.6.0", body: "Bug fixes", downloadAndInstall });
  renderHook(() => useAutoUpdater());
  await act(async () => { await vi.advanceTimersByTimeAsync(2500); });

  expect(toast.info).toHaveBeenCalledWith("IFROG 1.6.0 is available", expect.objectContaining({ description: "Bug fixes" }));
  const { action } = toast.info.mock.calls[0][1] as { action: { onClick: () => void } };
  await act(async () => { action.onClick(); await vi.runOnlyPendingTimersAsync(); });

  expect(downloadAndInstall).toHaveBeenCalledTimes(1);
  expect(toast.loading).toHaveBeenCalledWith("Downloading IFROG 1.6.0… 50%", expect.anything());
  expect(toast.success).toHaveBeenCalled();
  expect(relaunch).toHaveBeenCalledTimes(1);
});

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { updateSettings } from "./useAppSettings";
import { useAutoUpdater } from "./useAutoUpdater";

const { check } = vi.hoisted(() => ({ check: vi.fn().mockResolvedValue(null) }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn(), message: vi.fn() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));

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

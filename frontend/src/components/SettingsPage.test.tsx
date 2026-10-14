import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "../hooks/useAppSettings";
import { SettingsPage } from "./SettingsPage";
import { ThemeToggle } from "./ThemeToggle";
import { AIThreadStartHero } from "./AIThreadStartHero";
import { FileInspector } from "./FileInspector";
import appConfig from "../../src-tauri/tauri.conf.json";

vi.mock("../api/fileApi", () => ({ fileApi: {
  getContent: vi.fn().mockResolvedValue({ file_id: 1, path: "main.py", content: "\tprint('hello')", is_binary: false, truncated: false }),
  getSymbols: vi.fn().mockResolvedValue([]),
} }));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("style");
  document.documentElement.classList.remove("dark");
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Settings", () => {
  it("applies themes and synchronizes with the header toggle", async () => {
    const user = userEvent.setup();
    render(<><SettingsPage /><ThemeToggle /></>);
    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("devpilot_theme")).toBe("light");
    await user.click(screen.getByRole("button", { name: "Toggle visual theme" }));
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("follows system theme changes only while system mode is selected", () => {
    let onChange!: () => void;
    const media = { matches: false, addEventListener: vi.fn((_event, callback) => { onChange = callback; }), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", () => media);
    render(<SettingsPage />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    act(() => { media.matches = true; onChange(); });
    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    act(() => { media.matches = false; onChange(); });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("applies font and accent preferences and preserves them after remounting", () => {
    const view = render(<SettingsPage />);
    fireEvent.change(screen.getByRole("slider", { name: "Interface font size: 16px" }), { target: { value: "18" } });
    fireEvent.click(screen.getByRole("button", { name: "Blue accent" }));
    fireEvent.click(screen.getByRole("button", { name: "Right" }));
    expect(document.documentElement.style.fontSize).toBe("18px");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("#3b82f6");
    view.unmount();
    render(<SettingsPage />);
    expect(screen.getByRole("slider", { name: "Interface font size: 18px" })).toHaveValue("18");
    expect(screen.getByRole("button", { name: "Right" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Blue accent" })).toHaveAttribute("aria-pressed", "true");
  });

  it("saves supported AI preferences and uses the default provider in new conversations", async () => {
    const user = userEvent.setup();
    const view = render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: "AI Agent" }));
    const provider = screen.getByRole("combobox", { name: "Default provider" });
    expect(Array.from((provider as HTMLSelectElement).options).map(option => option.text)).toEqual(["Gemini", "Codex"]);
    await user.selectOptions(provider, "codex");
    await user.click(screen.getByRole("switch", { name: "Stream responses" }));
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
    expect(saved.defaultProvider).toBe("codex");
    expect(saved.streamOutput).toBe(false);
    view.unmount();
    const submit = vi.fn();
    render(<AIThreadStartHero onSubmitPrompt={submit} />);
    await user.type(screen.getByPlaceholderText("Ask anything"), "Explain this project{Enter}");
    expect(submit).toHaveBeenCalledWith("Explain this project", "Codex", "High");
  });

  it("applies editor preferences to the actual source preview", async () => {
    render(<><SettingsPage /><FileInspector file={{ name: "main.py", path: "main.py", is_directory: false, file_id: 1, language: "python", size_bytes: 20, children: [] }} onClose={vi.fn()} /></>);
    await screen.findByRole("button", { name: "Line 1" });
    fireEvent.click(screen.getByRole("button", { name: "Editor" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Tab size" }), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("switch", { name: "Word wrap" }));
    fireEvent.click(screen.getByRole("switch", { name: "Line numbers" }));
    expect(screen.queryByRole("button", { name: "Line 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Source code" })).toHaveStyle({ tabSize: "8" });
    expect(screen.getByText("print('hello')")).toHaveStyle({ whiteSpace: "pre-wrap" });
  });

  it("persists Git refresh and desktop update preferences", () => {
    const view = render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Status refresh interval" }), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    fireEvent.click(screen.getByRole("switch", { name: "Check for updates on startup" }));
    view.unmount();
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    expect(screen.getByRole("combobox", { name: "Status refresh interval" })).toHaveValue("0");
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("switch", { name: "Check for updates on startup" })).toHaveAttribute("aria-checked", "false");
  });

  it("resets preferences while preserving repository and conversation data", () => {
    localStorage.setItem("ifrog_repo_path", "/project");
    localStorage.setItem("threads_7", "saved conversations");
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Right" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset preferences" }));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toEqual(DEFAULT_SETTINGS);
    expect(localStorage.getItem("ifrog_repo_path")).toBe("/project");
    expect(localStorage.getItem("threads_7")).toBe("saved conversations");
  });

  it("falls back to valid defaults for corrupt preferences and reads the real version", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: "invalid", fontSize: 900, tabSize: 100, gitRefreshInterval: -1 }));
    render(<SettingsPage />);
    expect(screen.getByRole("slider", { name: "Interface font size: 16px" })).toHaveValue("16");
    fireEvent.click(screen.getByRole("button", { name: "About" }));
    expect(screen.getByText(appConfig.version)).toBeInTheDocument();
    expect(screen.queryByText("1.0.0-beta")).not.toBeInTheDocument();
  });
});

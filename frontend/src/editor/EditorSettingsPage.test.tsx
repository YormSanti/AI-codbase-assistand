import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorSettingsPage } from "./EditorSettingsPage";

describe("EditorSettingsPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders editor preferences and live code preview", () => {
    const onReturn = vi.fn();
    render(<EditorSettingsPage active onReturn={onReturn} />);

    expect(screen.getByText("Editor Settings")).toBeVisible();
    expect(screen.getByText("Live Preview")).toBeVisible();
    expect(screen.getByText("Editor: Font Size")).toBeVisible();
    expect(screen.getByText("Editor: Word Wrap")).toBeVisible();
    expect(screen.getByText("Editor: Tab Size")).toBeVisible();
    expect(screen.getByText("Back to code")).toBeVisible();
  });

  it("filters preferences by search query", () => {
    render(<EditorSettingsPage active onReturn={vi.fn()} />);

    const searchInput = screen.getByRole("textbox", { name: "Search Settings" });
    fireEvent.change(searchInput, { target: { value: "scrollback" } });

    expect(screen.getByText("Terminal: Scrollback Lines")).toBeVisible();
    expect(screen.queryByText("Editor: Font Size")).toBeNull();
  });

  it("adjusts font size with stepper buttons", () => {
    render(<EditorSettingsPage active onReturn={vi.fn()} />);

    const increaseBtn = screen.getByRole("button", { name: "Increase font size" });
    const fontSizeInput = screen.getByLabelText("Editor: Font Size") as HTMLInputElement;

    const initialSize = Number.parseInt(fontSizeInput.value, 10);
    fireEvent.click(increaseBtn);

    expect(Number.parseInt(fontSizeInput.value, 10)).toBe(initialSize + 1);
  });

  it("toggles word wrap preference switch", () => {
    render(<EditorSettingsPage active onReturn={vi.fn()} />);

    const wrapSwitch = screen.getByRole("switch", { name: "Editor: Word Wrap" });
    const initialAria = wrapSwitch.getAttribute("aria-checked");

    fireEvent.click(wrapSwitch);
    expect(wrapSwitch.getAttribute("aria-checked")).not.toBe(initialAria);
  });

  it("resets preferences to defaults when clicking Reset Defaults", () => {
    render(<EditorSettingsPage active onReturn={vi.fn()} />);

    const increaseBtn = screen.getByRole("button", { name: "Increase font size" });
    fireEvent.click(increaseBtn);
    fireEvent.click(increaseBtn);

    const resetBtn = screen.getByRole("button", { name: "Reset preferences" });
    fireEvent.click(resetBtn);

    const fontSizeInput = screen.getByLabelText("Editor: Font Size") as HTMLInputElement;
    expect(fontSizeInput.value).toBe("13");
  });

  it("calls onReturn when clicking Back to code", () => {
    const onReturn = vi.fn();
    render(<EditorSettingsPage active onReturn={onReturn} />);

    fireEvent.click(screen.getByRole("button", { name: "Back to code" }));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("calls onNavigateToGlobalSettings when clicking Global IFROG Settings button", () => {
    const onNavigateToGlobalSettings = vi.fn();
    render(
      <EditorSettingsPage
        active
        onReturn={vi.fn()}
        onNavigateToGlobalSettings={onNavigateToGlobalSettings}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Global IFROG Settings" }));
    expect(onNavigateToGlobalSettings).toHaveBeenCalledTimes(1);
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette, type PaletteCommand } from "./CommandPalette";

afterEach(() => cleanup());

function commands(run = vi.fn()): PaletteCommand[] {
  return [
    { id: "dashboard", label: "Go to Dashboard", group: "Navigate", run: () => run("dashboard") },
    { id: "git", label: "Go to Git Repository", group: "Navigate", keywords: "source control commits", run: () => run("git") },
    { id: "settings", label: "Go to Settings", group: "Navigate", run: () => run("settings") },
    { id: "open-b", label: "Open project b", group: "Projects", hint: "/home/dev/b", run: () => run("open-b") },
    { id: "hidden", label: "Hidden action", group: "Actions", disabled: true, run: () => run("hidden") },
  ];
}

describe("CommandPalette", () => {
  it("filters by any word in label, group, hint, or keywords and hides disabled commands", () => {
    render(<CommandPalette open onOpenChange={vi.fn()} commands={commands()} />);
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect(screen.queryByText("Hidden action")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Command palette" }), { target: { value: "source" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: /Git Repository/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.change(screen.getByRole("combobox", { name: "Command palette" }), { target: { value: "dev/b" } });
    expect(screen.getByRole("option", { name: /Open project b/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Command palette" }), { target: { value: "zzz" } });
    expect(screen.getByText("No matching commands.")).toBeInTheDocument();
  });

  it("runs the highlighted command with the keyboard and closes", () => {
    const run = vi.fn();
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} commands={commands(run)} />);
    const input = screen.getByRole("combobox", { name: "Command palette" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /Settings/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(run).toHaveBeenCalledWith("git");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("runs a command on click", () => {
    const run = vi.fn();
    render(<CommandPalette open onOpenChange={vi.fn()} commands={commands(run)} />);
    fireEvent.click(screen.getByRole("option", { name: /Open project b/ }));
    expect(run).toHaveBeenCalledWith("open-b");
  });
});

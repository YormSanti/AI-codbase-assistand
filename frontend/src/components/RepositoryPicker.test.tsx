import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RepositoryPicker } from "./RepositoryPicker";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
import { open } from "@tauri-apps/plugin-dialog";

afterEach(() => {
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  vi.clearAllMocks();
});

describe("RepositoryPicker", () => {
  it("submits the trimmed path", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<RepositoryPicker onOpen={onOpen} isLoading={false} />);

    await user.type(screen.getByLabelText("Repository path"), "  /repo/path  ");
    await user.click(screen.getByRole("button", { name: /open repository/i }));

    expect(onOpen).toHaveBeenCalledWith("/repo/path");
  });

  it("disables the submit button while empty", () => {
    render(<RepositoryPicker onOpen={vi.fn()} isLoading={false} />);

    expect(screen.getByRole("button", { name: /open repository/i })).toBeDisabled();
  });

  it("shows a loading label and disables the button while opening", () => {
    render(<RepositoryPicker onOpen={vi.fn()} isLoading={true} />);

    expect(screen.getByRole("button", { name: /opening/i })).toBeDisabled();
  });
  it("shows a failed open and lets the user retry", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn().mockRejectedValueOnce(new Error("Not a Git repository")).mockResolvedValue(undefined);
    render(<RepositoryPicker onOpen={onOpen} isLoading={false} />);
    await user.type(screen.getByLabelText("Repository path"), "/repo/path");
    await user.click(screen.getByRole("button", { name: /open repository/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not a Git repository");
    await user.click(screen.getByRole("button", { name: /open repository/i }));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows folder-picker failures without an unhandled rejection", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true });
    vi.mocked(open).mockRejectedValueOnce(new Error("Folder picker unavailable"));
    const user = userEvent.setup();
    render(<RepositoryPicker onOpen={vi.fn()} isLoading={false} />);
    await user.click(screen.getByRole("button", { name: "Browse folders" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Folder picker unavailable");
    expect(screen.getByRole("button", { name: "Browse folders" })).toBeEnabled();
  });

  it("shows a failure opening a folder selected in the desktop picker", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true });
    vi.mocked(open).mockResolvedValueOnce("/invalid/repo");
    const user = userEvent.setup();
    const onOpen = vi.fn().mockRejectedValueOnce(new Error("Repository missing"));
    render(<RepositoryPicker onOpen={onOpen} isLoading={false} />);
    await user.click(screen.getByRole("button", { name: "Browse folders" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Repository missing");
    expect(screen.getByLabelText("Repository path")).toHaveValue("/invalid/repo");
  });

});

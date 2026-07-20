import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RepositoryPicker } from "./RepositoryPicker";

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
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("renders theme toggle button and toggles dataset theme attribute", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: /toggle visual theme/i });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(document.documentElement.getAttribute("data-theme")).toBeTruthy();
  });
});

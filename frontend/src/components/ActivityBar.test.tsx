import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActivityBar } from "./ActivityBar";

describe("ActivityBar", () => {
  it("renders activity icons and handles tab switching", async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();
    render(
      <ActivityBar
        activeTab="explorer"
        onSelectTab={onSelectTab}
        hasRepository={true}
      />
    );

    expect(screen.getByLabelText("File Explorer")).toBeInTheDocument();
    expect(screen.getByLabelText("Git Source Control")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Git Source Control"));
    expect(onSelectTab).toHaveBeenCalledWith("git");
  });
});

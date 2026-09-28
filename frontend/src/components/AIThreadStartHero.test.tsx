import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AIThreadStartHero } from "./AIThreadStartHero";
import type { RepositoryInfo } from "../types/domain";

const mockRepo: RepositoryInfo = {
  id: 1,
  name: "pharmacy-mobile-v2",
  root_path: "/home/ksk/pharmacy-mobile-v2",
  current_branch: "santi",
  head_commit: "9c3f1a2e4b",
  opened_at: "2026-08-26T10:00:00Z",
  file_count: 84,
};

describe("AIThreadStartHero", () => {
  it("renders header with project name and pill selectors", () => {
    render(
      <AIThreadStartHero
        repository={mockRepo}
        onSubmitPrompt={vi.fn()}
      />
    );

    expect(screen.getByText(/What should we build in/)).toBeInTheDocument();
    expect(screen.getAllByText("pharmacy-mobile-v2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("img", { name: "IFROG" })).toBeInTheDocument();
    expect(screen.getByText("Gemini")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("santi")).toBeInTheDocument();
  });

  it("submits prompt when clicking send button", async () => {
    const user = userEvent.setup();
    const onSubmitPrompt = vi.fn();

    render(
      <AIThreadStartHero
        repository={mockRepo}
        onSubmitPrompt={onSubmitPrompt}
      />
    );

    const textarea = screen.getByPlaceholderText("Ask about your codebase…");
    await user.type(textarea, "Refactor auth controller");

    const sendBtn = screen.getByTitle("Send instruction");
    await user.click(sendBtn);

    expect(onSubmitPrompt).toHaveBeenCalledWith(
      "Refactor auth controller",
      "Gemini",
      "High"
    );
  });
});

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
  it("renders agenda title, ask anything input, think button, and quick actions", () => {
    render(
      <AIThreadStartHero
        repository={mockRepo}
        onSubmitPrompt={vi.fn()}
      />
    );

    expect(screen.getByText("What’s on the agenda today?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask anything")).toBeInTheDocument();
    expect(screen.getByText("Think")).toBeInTheDocument();
    expect(screen.getByTitle("Voice input")).toBeInTheDocument();
    expect(screen.getByTitle("Send instruction")).toBeInTheDocument();
    expect(screen.getByText("Write or edit")).toBeInTheDocument();
    expect(screen.getByText("Search the web")).toBeInTheDocument();
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

    const input = screen.getByPlaceholderText("Ask anything");
    await user.type(input, "Refactor auth controller");

    const sendBtn = screen.getByTitle("Send instruction");
    await user.click(sendBtn);

    expect(onSubmitPrompt).toHaveBeenCalledWith(
      "Refactor auth controller",
      "Gemini",
      "High"
    );
  });

  it("submits prompt when pressing Enter", async () => {
    const user = userEvent.setup();
    const onSubmitPrompt = vi.fn();

    render(
      <AIThreadStartHero
        repository={mockRepo}
        onSubmitPrompt={onSubmitPrompt}
      />
    );

    const input = screen.getByPlaceholderText("Ask anything");
    await user.type(input, "Explain main logic{Enter}");

    expect(onSubmitPrompt).toHaveBeenCalledWith(
      "Explain main logic",
      "Gemini",
      "High"
    );
  });

  it("populates prompt when clicking quick action suggestions", async () => {
    const user = userEvent.setup();
    render(
      <AIThreadStartHero
        repository={mockRepo}
        onSubmitPrompt={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Ask anything");
    const writeOrEdit = screen.getByText("Write or edit");
    await user.click(writeOrEdit);

    expect(input).toHaveValue("Write or edit: ");

    const searchWeb = screen.getByText("Search the web");
    await user.click(searchWeb);

    expect(input).toHaveValue("Search the web for: ");
  });
});

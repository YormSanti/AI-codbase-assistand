import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AIThreadStartHero } from "./AIThreadStartHero";
import type { RepositoryInfo } from "../types/domain";

const mockRepo: RepositoryInfo = {
  id: 1,
  name: "sample-project",
  root_path: "/home/dev/sample-project",
  current_branch: "main",
  head_commit: "9c3f1a2e4b",
  opened_at: "2026-08-26T10:00:00Z",
  file_count: 84,
};

describe("AIThreadStartHero", () => {
  it("renders the composer, model picker, and quick prompts", () => {
    render(<AIThreadStartHero repository={mockRepo} onSubmitPrompt={vi.fn()} />);

    expect(screen.getByText("What’s on the agenda today?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask anything")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gemini" })).toBeInTheDocument();
    expect(screen.getByTitle("Send instruction")).toBeInTheDocument();
    expect(screen.getByText("Explain this project")).toBeInTheDocument();
    expect(screen.getByText("Review for bugs")).toBeInTheDocument();
    // Voice input is hidden when the engine has no speech recognition.
    expect(screen.queryByTitle("Voice input")).not.toBeInTheDocument();
  });

  it("submits the prompt with the selected model", async () => {
    const user = userEvent.setup();
    const onSubmitPrompt = vi.fn();
    render(<AIThreadStartHero repository={mockRepo} onSubmitPrompt={onSubmitPrompt} />);

    await user.type(screen.getByPlaceholderText("Ask anything"), "Refactor auth controller");
    await user.click(screen.getByTitle("Send instruction"));

    expect(onSubmitPrompt).toHaveBeenCalledWith("Refactor auth controller", "Gemini");
  });

  it("submits on Enter", async () => {
    const user = userEvent.setup();
    const onSubmitPrompt = vi.fn();
    render(<AIThreadStartHero repository={mockRepo} onSubmitPrompt={onSubmitPrompt} />);

    await user.type(screen.getByPlaceholderText("Ask anything"), "Explain main logic{Enter}");

    expect(onSubmitPrompt).toHaveBeenCalledWith("Explain main logic", "Gemini");
  });

  it("switches provider from the model picker and reports the change", async () => {
    const user = userEvent.setup();
    const onSubmitPrompt = vi.fn();
    const onModelChange = vi.fn();
    render(<AIThreadStartHero repository={mockRepo} onSubmitPrompt={onSubmitPrompt} onModelChange={onModelChange} />);

    await user.click(screen.getByRole("button", { name: "Gemini" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Codex" }));
    expect(onModelChange).toHaveBeenCalledWith("Codex");
    expect(screen.getByRole("button", { name: "Codex" })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Ask anything"), "Hello{Enter}");
    expect(onSubmitPrompt).toHaveBeenCalledWith("Hello", "Codex");
  });

  it("fills the composer from a quick prompt without sending", async () => {
    const user = userEvent.setup();
    const onSubmitPrompt = vi.fn();
    render(<AIThreadStartHero repository={mockRepo} onSubmitPrompt={onSubmitPrompt} />);

    await user.click(screen.getByText("Explain this project"));

    expect(screen.getByPlaceholderText("Ask anything")).toHaveValue("Explain the architecture of this project and how its main parts fit together.");
    expect(onSubmitPrompt).not.toHaveBeenCalled();
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitPage } from "./GitPage";

const repository = { id: 1, name: "sample", root_path: "/sample", current_branch: "feature/original", head_commit: "123456789abcdef", opened_at: "2026-10-06T01:00:00Z", file_count: 12 };

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("original Git Repository dashboard", () => {
  it("shows the original repository, branch, and activity cards", () => {
    render(<GitPage repository={repository} onNavigate={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Git Repository" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Repository Details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Branch & Commit" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Git Activity" })).toBeInTheDocument();
    expect(screen.getByText("sample")).toBeInTheDocument();
    expect(screen.getByText("/sample")).toBeInTheDocument();
    expect(screen.getByText("feature/original")).toBeInTheDocument();
    expect(screen.getByText(repository.head_commit)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("feat: add premium git dashboard")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review with AI" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("File diff")).not.toBeInTheDocument();
  });

  it("keeps the original connection action when no repository is selected", () => {
    const navigate = vi.fn();
    render(<GitPage repository={null} onNavigate={navigate} />);
    expect(screen.getByText("No Repository Connected")).toBeInTheDocument();
    expect(screen.queryByText("Repository Details")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open on GitHub" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect Repository" }));
    expect(navigate).toHaveBeenCalledWith("explorer");
  });

  it("retains the original project GitHub shortcut", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<GitPage repository={repository} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open on GitHub" }));
    expect(open).toHaveBeenCalledWith("https://github.com/YormSanti/AI-codbase-assistand", "_blank");
  });
});

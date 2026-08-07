import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RepositorySummary } from "./RepositorySummary";
import type { RepositoryInfo } from "../types/domain";

const mockRepo: RepositoryInfo = {
  id: 1,
  name: "demo-repo",
  root_path: "/home/user/demo-repo",
  current_branch: "main",
  head_commit: "a1b2c3d4e5f6789",
  opened_at: "2026-08-07T12:00:00Z",
  file_count: 42,
};

describe("RepositorySummary", () => {
  it("renders repository name, branch, commit hash and file count", () => {
    render(<RepositorySummary repository={mockRepo} />);

    expect(screen.getByText("demo-repo")).toBeInTheDocument();
    expect(screen.getByText("/home/user/demo-repo")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("a1b2c3d")).toBeInTheDocument();
    expect(screen.getByText("42 files")).toBeInTheDocument();
  });
});

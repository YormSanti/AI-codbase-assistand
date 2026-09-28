import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsPage } from "./AnalyticsPage";
import type { RepositoryInfo, TreeNode } from "../types/domain";

const mockRepo: RepositoryInfo = {
  id: 1,
  name: "pharmacy-mobile-v2",
  root_path: "/home/ksk/pharmacy-mobile-v2",
  current_branch: "main",
  head_commit: "9c3f1a2e4b",
  opened_at: "2026-08-26T10:00:00Z",
  file_count: 3,
};

const mockTree: TreeNode = {
  name: "pharmacy-mobile-v2",
  path: "",
  is_directory: true,
  language: null,
  size_bytes: null,
  file_id: null,
  children: [
    {
      name: "src",
      path: "src",
      is_directory: true,
      language: null,
      size_bytes: null,
      file_id: null,
      children: [
        {
          name: "index.ts",
          path: "src/index.ts",
          is_directory: false,
          language: "typescript",
          size_bytes: 4096,
          file_id: 101,
          children: [],
        },
        {
          name: "App.tsx",
          path: "src/App.tsx",
          is_directory: false,
          language: "tsx",
          size_bytes: 12288,
          file_id: 102,
          children: [],
        },
      ],
    },
    {
      name: "package.json",
      path: "package.json",
      is_directory: false,
      language: "json",
      size_bytes: 1024,
      file_id: 103,
      children: [],
    },
  ],
};

describe("AnalyticsPage", () => {
  it("renders empty state with navigation actions when no repository is selected", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<AnalyticsPage repository={null} tree={null} onNavigate={onNavigate} />);

    expect(screen.getByText("Codebase Analytics & Charts")).toBeInTheDocument();
    expect(screen.getByText(/Open or select a local repository/)).toBeInTheDocument();
    
    const browseBtn = screen.getByRole("button", { name: /Browse Projects/ });
    await user.click(browseBtn);
    expect(onNavigate).toHaveBeenCalledWith("projects");
  });

  it("renders code analytics metrics and charts for active repository", () => {
    render(<AnalyticsPage repository={mockRepo} tree={mockTree} />);

    expect(screen.getByText("Code Analytics")).toBeInTheDocument();
    expect(screen.getByText("pharmacy-mobile-v2")).toBeInTheDocument();
    expect(screen.getByText("Total Files")).toBeInTheDocument();
    expect(screen.getByText("Codebase Volume")).toBeInTheDocument();
    expect(screen.getByText("Language Composition")).toBeInTheDocument();
    expect(screen.getAllByText("File Granularity").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Largest Files by Size")).toBeInTheDocument();
    expect(screen.getByText("App.tsx")).toBeInTheDocument();
    expect(screen.getByText("index.ts")).toBeInTheDocument();
  });

  it("toggles metric mode between files and size, and chart type between bar and donut", async () => {
    const user = userEvent.setup();

    render(<AnalyticsPage repository={mockRepo} tree={mockTree} />);

    const sizeBtn = screen.getByRole("button", { name: "Size" });
    await user.click(sizeBtn);

    const donutBtn = screen.getByTitle("Donut Chart");
    await user.click(donutBtn);
    expect(screen.getByTestId("language-donut-chart")).toBeInTheDocument();

    const barBtn = screen.getByTitle("Bar Chart");
    await user.click(barBtn);
    expect(screen.getByTestId("language-bar-chart")).toBeInTheDocument();
  });
});

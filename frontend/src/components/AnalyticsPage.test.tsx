import { render, screen, within } from "@testing-library/react";
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
    
    const browseBtn = screen.getByRole("button", { name: /File Explorer/ });
    await user.click(browseBtn);
    expect(onNavigate).toHaveBeenCalledWith("explorer");
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

  it("uses the selected metric for the dominant language and chart axis", async () => {
    const user = userEvent.setup();
    const tree: TreeNode = {
      ...mockTree,
      children: [
        { name: "one.ts", path: "one.ts", is_directory: false, language: "typescript", size_bytes: 1024, file_id: 1, children: [] },
        { name: "two.ts", path: "two.ts", is_directory: false, language: "typescript", size_bytes: 1024, file_id: 2, children: [] },
        { name: "main.py", path: "main.py", is_directory: false, language: "python", size_bytes: 8192, file_id: 3, children: [] },
      ],
    };
    render(<AnalyticsPage repository={mockRepo} tree={tree} />);

    expect(screen.getByText("typescript (66.7%)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Files" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Size" }));

    expect(screen.getByText("python (80%)")).toBeInTheDocument();
    expect(screen.getByText("python leads (80%)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Size" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByTestId("language-bar-chart")).getAllByText(/KB$/).length).toBeGreaterThan(0);
  });

  it("includes every language in the bar chart and donut instead of dropping the tail", async () => {
    const user = userEvent.setup();
    const languages: NonNullable<TreeNode["language"]>[] = ["typescript", "python", "javascript", "css", "html", "json", "yaml", "markdown", "rust", "go", "shell", "other"];
    const tree: TreeNode = {
      ...mockTree,
      children: languages.map((language, index) => ({
        name: `file-${index}`, path: `file-${index}`, is_directory: false,
        language, size_bytes: 1024, file_id: index, children: [],
      })),
    };
    render(<AnalyticsPage repository={mockRepo} tree={tree} />);

    const bar = within(screen.getByTestId("language-bar-chart"));
    for (const language of languages) expect(bar.getByText(language)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Donut Chart" }));
    const legend = within(screen.getByRole("list", { name: "Language composition" }));
    expect(legend.getAllByRole("listitem")).toHaveLength(languages.length);
    for (const language of languages) expect(legend.getByText(language)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Donut Chart" })).toHaveAttribute("aria-pressed", "true");
  });

  it("explains zero-byte size data and still supports the file-count chart", async () => {
    const user = userEvent.setup();
    const tree: TreeNode = {
      ...mockTree,
      children: [{ name: "empty.ts", path: "empty.ts", is_directory: false, language: "typescript", size_bytes: 0, file_id: 1, children: [] }],
    };
    render(<AnalyticsPage repository={mockRepo} tree={tree} />);
    await user.click(screen.getByRole("button", { name: "Size" }));
    await user.click(screen.getByRole("button", { name: "Donut Chart" }));

    expect(screen.getByRole("status")).toHaveTextContent("Indexed files have no recorded size");
    expect(screen.queryByTestId("language-donut-chart")).not.toBeInTheDocument();
    expect(screen.getByText("No data")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Files" }));
    expect(screen.getByTestId("language-donut-chart")).toBeInTheDocument();
    expect(screen.getByText("typescript (100%)")).toBeInTheDocument();
  });

  it("shows a loading state until the repository tree is ready", () => {
    const { rerender } = render(<AnalyticsPage repository={null} tree={null} isLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading repository analytics");
    expect(screen.queryByText("Codebase Analytics & Charts")).not.toBeInTheDocument();

    rerender(<AnalyticsPage repository={mockRepo} tree={mockTree} isLoading={false} />);
    expect(screen.getByTestId("language-bar-chart")).toBeInTheDocument();
  });

  it("handles an empty index without displaying an undefined dominant language", () => {
    render(<AnalyticsPage repository={mockRepo} tree={{ ...mockTree, children: [] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("No indexed files available");
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.getByText("No indexed files to analyze.")).toBeInTheDocument();
    expect(screen.queryByText(/undefined|NaN/)).not.toBeInTheDocument();
  });
});

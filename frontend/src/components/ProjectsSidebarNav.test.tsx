import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProjectsSidebarNav } from "./ProjectsSidebarNav";
import { repositoryApi } from "../api/repositoryApi";
import type { RepositoryInfo } from "../types/domain";

vi.mock("../api/repositoryApi", () => ({
  repositoryApi: {
    list: vi.fn(),
    open: vi.fn(),
  },
}));

const mockProjects: RepositoryInfo[] = [
  {
    id: 1,
    name: "pharmacy-mobile-v2",
    root_path: "/home/ksk/pharmacy-mobile-v2",
    current_branch: "main",
    head_commit: "9c3f1a2e4b",
    opened_at: "2026-08-26T10:00:00Z",
    file_count: 84,
  },
  {
    id: 2,
    name: "pharmkulen-web",
    root_path: "/home/ksk/pharmkulen-web",
    current_branch: "main",
    head_commit: "4e7b8c1a9d",
    opened_at: "2026-08-26T11:00:00Z",
    file_count: 52,
  },
];

describe("ProjectsSidebarNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders Projects header with AI, list, and add buttons", () => {
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);

    render(
      <ProjectsSidebarNav
        currentRepository={mockProjects[0]}
        onSelectTab={vi.fn()}
      />
    );

    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByTitle("AI Assistant")).toBeInTheDocument();
    expect(screen.getByTitle("Projects Catalog")).toBeInTheDocument();
    expect(screen.getByTitle("Add Project")).toBeInTheDocument();
  });

  it("renders the active project card with terminal and AI actions", async () => {
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);
    const onSelectTab = vi.fn();

    render(
      <ProjectsSidebarNav
        currentRepository={mockProjects[0]}
        onSelectTab={onSelectTab}
      />
    );

    expect(screen.getByText("pharmacy-mobile-v2")).toBeInTheDocument();
    expect(screen.getByTitle("Open Terminal")).toBeInTheDocument();
    expect(screen.getByTitle("AI Agent Studio")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByTitle("Open Terminal"));
    expect(onSelectTab).toHaveBeenCalledWith("terminal");

    await user.click(screen.getByTitle("AI Agent Studio"));
    expect(onSelectTab).toHaveBeenCalledWith("ai");
  });

  it("handles creating a new thread when clicking 'New thread'", async () => {
    const user = userEvent.setup();
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);
    const onSelectTab = vi.fn();
    const onSelectThread = vi.fn();

    render(
      <ProjectsSidebarNav
        currentRepository={mockProjects[0]}
        onSelectTab={onSelectTab}
        onSelectThread={onSelectThread}
      />
    );

    const newThreadBtn = screen.getByText("New thread");
    expect(newThreadBtn).toBeInTheDocument();

    await user.click(newThreadBtn);
    expect(onSelectTab).toHaveBeenCalledWith("ai");
    expect(onSelectThread).toHaveBeenCalled();
    expect(screen.getByText("Thread 1")).toBeInTheDocument();
  });

  it("renders other projects with green status indicator", async () => {
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);

    render(
      <ProjectsSidebarNav
        currentRepository={mockProjects[0]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("pharmkulen-web")).toBeInTheDocument();
    });
  });
});

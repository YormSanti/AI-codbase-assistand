import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProjectsPage } from "./ProjectsPage";
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
    name: "DevPilot-AI",
    root_path: "/home/user/DevPilot-AI",
    current_branch: "main",
    head_commit: "a1b2c3d4e5f6",
    opened_at: "2026-08-25T10:00:00Z",
    file_count: 42,
  },
  {
    id: 2,
    name: "FastAPI-Backend",
    root_path: "/home/user/FastAPI-Backend",
    current_branch: "dev",
    head_commit: "f6e5d4c3b2a1",
    opened_at: "2026-08-24T12:00:00Z",
    file_count: 18,
  },
];

describe("ProjectsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Projects page and fetches repository list", async () => {
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);

    render(
      <ProjectsPage
        currentRepository={mockProjects[0]}
        isLoading={false}
        onOpen={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText("Projects & Repositories")).toBeInTheDocument();
    expect(screen.getByText("DevPilot Workspace Hub")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("DevPilot-AI").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("FastAPI-Backend")).toBeInTheDocument();
    });
  });

  it("filters indexed repositories with search query", async () => {
    const user = userEvent.setup();
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);

    render(
      <ProjectsPage
        currentRepository={null}
        isLoading={false}
        onOpen={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("DevPilot-AI")).toBeInTheDocument();
      expect(screen.getByText("FastAPI-Backend")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search projects...");
    await user.type(searchInput, "FastAPI");

    expect(screen.queryByText("DevPilot-AI")).not.toBeInTheDocument();
    expect(screen.getByText("FastAPI-Backend")).toBeInTheDocument();
  });

  it("handles opening a new project path from input form", async () => {
    const user = userEvent.setup();
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);
    const onOpen = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectsPage
        currentRepository={null}
        isLoading={false}
        onOpen={onOpen}
        onNavigate={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("/home/user/my-awesome-project");
    await user.type(input, "/home/user/new-project");

    const submitBtn = screen.getByRole("button", { name: /open project/i });
    await user.click(submitBtn);

    expect(onOpen).toHaveBeenCalledWith("/home/user/new-project");
  });

  it("handles switching to an existing project", async () => {
    const user = userEvent.setup();
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);
    const onOpen = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectsPage
        currentRepository={mockProjects[0]}
        isLoading={false}
        onOpen={onOpen}
        onNavigate={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("FastAPI-Backend")).toBeInTheDocument();
    });

    const switchBtn = screen.getByRole("button", { name: /switch/i });
    await user.click(switchBtn);

    expect(onOpen).toHaveBeenCalledWith("/home/user/FastAPI-Backend");
  });

  it("handles removing a project after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onDeleteRepository = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectsPage
        currentRepository={mockProjects[0]}
        isLoading={false}
        onOpen={vi.fn()}
        onNavigate={vi.fn()}
        onDeleteRepository={onDeleteRepository}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("FastAPI-Backend")).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole("button", { name: "Remove FastAPI-Backend" });
    await user.click(removeBtn);

    expect(onDeleteRepository).toHaveBeenCalledWith(2);
  });
});

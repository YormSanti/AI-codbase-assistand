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
    remove: vi.fn(),
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

  it("renders Projects header with AI, refresh, and add buttons", async () => {
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);

    render(
      <ProjectsSidebarNav
        currentRepository={mockProjects[0]}
        onSelectTab={vi.fn()}
      />
    );

    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByTitle("AI Assistant")).toBeInTheDocument();
    expect(screen.getByTitle("Refresh projects")).toBeInTheDocument();
    expect(screen.getByTitle("Add Project")).toBeInTheDocument();
    await waitFor(() => expect(repositoryApi.list).toHaveBeenCalled());
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
    expect(screen.getByRole("button", { name: "Open terminal for pharmacy-mobile-v2" })).toBeInTheDocument();
    expect(screen.getByTitle("AI Agent Studio")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open terminal for pharmacy-mobile-v2" }));
    expect(onSelectTab).toHaveBeenCalledWith("terminal");

    await user.click(screen.getByTitle("AI Agent Studio"));
    expect(onSelectTab).toHaveBeenCalledWith("ai");
  });

  it("opens another project's terminal without triggering the project row", async () => {
    const user = userEvent.setup();
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);
    const onOpenTerminal = vi.fn().mockResolvedValue(undefined);
    const onOpenRepository = vi.fn();
    const onSelectTab = vi.fn();
    render(<ProjectsSidebarNav currentRepository={mockProjects[0]} onOpenTerminal={onOpenTerminal} onOpenRepository={onOpenRepository} onSelectTab={onSelectTab} />);

    await user.click(await screen.findByRole("button", { name: "Open terminal for pharmkulen-web" }));
    expect(onOpenTerminal).toHaveBeenCalledExactlyOnceWith(mockProjects[1].root_path);
    expect(onOpenRepository).not.toHaveBeenCalled();
    expect(onSelectTab).not.toHaveBeenCalled();
  });

  it("shows a terminal-opening failure and allows retrying", async () => {
    const user = userEvent.setup();
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);
    const onOpenTerminal = vi.fn().mockRejectedValue(new Error("Project directory is missing"));
    render(<ProjectsSidebarNav currentRepository={mockProjects[0]} onOpenTerminal={onOpenTerminal} />);

    const button = await screen.findByRole("button", { name: "Open terminal for pharmkulen-web" });
    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Project directory is missing");
    expect(button).toBeEnabled();
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

    const newThreadBtn = screen.getByText("Start new session");
    expect(newThreadBtn).toBeInTheDocument();

    await user.click(newThreadBtn);
    expect(onSelectThread).toHaveBeenCalled();
    expect(onSelectTab).not.toHaveBeenCalled();
    expect(screen.getByText(/^Session ·/)).toBeInTheDocument();
  });

  it("deletes a thread after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<ProjectsSidebarNav currentRepository={mockProjects[0]} />);
    await user.click(screen.getByText("Start new session"));
    await user.click(screen.getByTitle("Delete Thread"));

    expect(screen.queryByText(/^Session ·/)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("threads_1") ?? "[]")).toEqual([]);
  });

  it("removes a project after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(repositoryApi.list).mockResolvedValue(mockProjects);
    vi.mocked(repositoryApi.remove).mockResolvedValue();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<ProjectsSidebarNav currentRepository={mockProjects[0]} />);
    await user.click(screen.getByLabelText("Remove pharmacy-mobile-v2"));

    expect(repositoryApi.remove).toHaveBeenCalledWith(1);
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
  it("does not invent projects when the list is empty", async () => {
    vi.mocked(repositoryApi.list).mockResolvedValue([]);
    render(<ProjectsSidebarNav currentRepository={null} />);
    await waitFor(() => expect(repositoryApi.list).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Open your first project" })).toBeInTheDocument();
    expect(screen.queryByText("pharmkulen-web")).not.toBeInTheDocument();
    expect(screen.queryByText("pharmacy-mobile-v2")).not.toBeInTheDocument();
    expect(screen.queryByText("Start new session")).not.toBeInTheDocument();
  });



});

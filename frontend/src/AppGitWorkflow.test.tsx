import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { RepositoryInfo } from "./types/domain";
import App from "./App";

vi.mock("./hooks/useAutoUpdater", () => ({ useAutoUpdater: vi.fn() }));
vi.mock("./api/repositoryApi", () => ({ repositoryApi: {
  open: vi.fn().mockResolvedValue({ id: 7, name: "project", root_path: "/project", current_branch: "feature/original", head_commit: "abcdef1234", opened_at: null, file_count: 3 }),
  getTree: vi.fn().mockResolvedValue({ name: "project", path: "", children: [] }),
} }));
vi.mock("@/components/ui/sidebar", () => ({ SidebarProvider: ({ children }: { children: ReactNode }) => children, SidebarInset: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/app-sidebar", () => ({ AppSidebar: () => null }));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/AIAgentPage", () => ({ AIAgentPage: ({ initialPrompt, repository }: { initialPrompt: string; repository: RepositoryInfo }) => <div role="log">{repository.root_path}{initialPrompt}</div> }));

afterEach(() => { cleanup(); localStorage.clear(); });

it("restores the selected project into the original Git Repository dashboard", async () => {
  localStorage.setItem("ifrog_active_tab", "git");
  localStorage.setItem("ifrog_repo_path", "/project");
  render(<App />);
  expect(await screen.findByText("/project")).toBeInTheDocument();
  expect(screen.getByText("feature/original")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Repository Details" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Git Activity" })).toBeInTheDocument();
  expect(screen.queryByRole("log")).not.toBeInTheDocument();
});

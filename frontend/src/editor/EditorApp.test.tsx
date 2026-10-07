import { useEffect, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RepositoryInfo } from "../types/domain";
import { EditorApp } from "./EditorApp";

const shells = vi.hoisted(() => ({ start: vi.fn(), close: vi.fn() }));
vi.mock("../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../api/gitApi", () => ({ gitApi: { getStatus: vi.fn().mockResolvedValue({ branch: "main", changes: [], commits: [], head_commit: null, upstream: null, ahead: null, behind: null, remote_url: null }), getDiff: vi.fn() } }));
vi.mock("../components/TerminalPage", () => ({ TerminalPage: ({ repository }: { repository: RepositoryInfo }) => {
  const [command, setCommand] = useState("");
  useEffect(() => { shells.start(repository.root_path); return () => { shells.close(repository.root_path); }; }, [repository.root_path]);
  return <input aria-label="Shell input" value={command} onChange={event => setCommand(event.target.value)} />;
} }));

const repository: RepositoryInfo = { id: 1, name: "project", root_path: "/project", current_branch: "main", head_commit: null, opened_at: null, file_count: 1 };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("keeps the file draft and shell when entering and leaving the editor through File Explorer", () => {
  const props = { active: false, repository, isLoading: false, onNavigate: vi.fn() };
  const view = render(<EditorApp {...props}><input aria-label="File draft" defaultValue="saved" /></EditorApp>);
  fireEvent.change(screen.getByLabelText("File draft"), { target: { value: "unsaved draft" } });
  view.rerender(<EditorApp {...props} active><input aria-label="File draft" defaultValue="saved" /></EditorApp>);
  expect(screen.getByLabelText("File draft")).toHaveValue("unsaved draft");
  expect(shells.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Toggle integrated terminal" }));
  fireEvent.change(screen.getByLabelText("Shell input"), { target: { value: "npm run dev" } });
  view.rerender(<EditorApp {...props}><input aria-label="File draft" defaultValue="saved" /></EditorApp>);
  expect(screen.getByLabelText("File draft")).toHaveValue("unsaved draft");
  expect(screen.getByLabelText("Shell input")).not.toBeVisible();
  expect(shells.close).not.toHaveBeenCalled();
  view.rerender(<EditorApp {...props} active><input aria-label="File draft" defaultValue="saved" /></EditorApp>);
  expect(screen.getByLabelText("Shell input")).toHaveValue("npm run dev");
  expect(shells.start).toHaveBeenCalledTimes(1);
});

it("switches a visible terminal to the new project and defers a hidden terminal until requested", () => {
  const props = { active: true, repository, isLoading: false, onNavigate: vi.fn() };
  const next = { ...repository, id: 2, name: "next", root_path: "/next" };
  const third = { ...repository, id: 3, name: "third", root_path: "/third" };
  const view = render(<EditorApp {...props}><span>workspace</span></EditorApp>);
  fireEvent.click(screen.getByRole("button", { name: "Toggle integrated terminal" }));
  expect(shells.start).toHaveBeenCalledWith("/project");
  view.rerender(<EditorApp {...props} repository={next}><span>workspace</span></EditorApp>);
  expect(shells.close).toHaveBeenCalledWith("/project");
  expect(shells.start).toHaveBeenLastCalledWith("/next");
  fireEvent.click(screen.getByRole("button", { name: "Hide integrated terminal" }));
  view.rerender(<EditorApp {...props} repository={third}><span>workspace</span></EditorApp>);
  expect(shells.close).toHaveBeenCalledWith("/next");
  expect(shells.start).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Toggle integrated terminal" }));
  expect(shells.start).toHaveBeenLastCalledWith("/third");
});

it("keeps drafts and the terminal alive while reviewing Git inside the editor", async () => {
  const onNavigate = vi.fn();
  render(<EditorApp active repository={repository} isLoading={false} onNavigate={onNavigate}>
    {visible => <input aria-label="File draft" defaultValue="saved" data-active={visible} />}
  </EditorApp>);
  fireEvent.change(screen.getByLabelText("File draft"), { target: { value: "unsaved" } });
  fireEvent.click(screen.getByRole("button", { name: "Toggle integrated terminal" }));
  fireEvent.change(screen.getByLabelText("Shell input"), { target: { value: "git status" } });
  fireEvent.click(screen.getByRole("button", { name: "Git Repository" }));
  expect((await screen.findAllByText("Working tree clean"))[0]).toBeVisible();
  expect(screen.getByLabelText("File draft")).not.toBeVisible();
  expect(screen.getByLabelText("File draft")).toHaveAttribute("data-active", "false");
  expect(screen.getByLabelText("Shell input")).toHaveValue("git status");
  expect(shells.close).not.toHaveBeenCalled();
  expect(onNavigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Back to code" }));
  expect(screen.getByLabelText("File draft")).toBeVisible();
  expect(screen.getByLabelText("File draft")).toHaveValue("unsaved");
  expect(shells.start).toHaveBeenCalledTimes(1);
});

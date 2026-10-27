import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { editorApi } from "../api/editorApi";
import type { SearchResults } from "../types/domain";
import { EditorSearchPage } from "./EditorSearchPage";

vi.mock("../api/editorApi", () => ({ editorApi: { search: vi.fn() } }));
const repository = { id: 4, name: "project", root_path: "/project", current_branch: "main", head_commit: null, opened_at: null, file_count: 3 };
const results: SearchResults = {
  query: "needle", files_scanned: 12, truncated: false,
  matches: [
    { path: "src/app.ts", line: 2, column: 5, text: "    const needle = find();" },
    { path: "src/app.ts", line: 9, column: 1, text: "needle.reset();" },
    { path: "docs/guide.md", line: 1, column: 7, text: "# The Needle guide" },
  ],
};
beforeEach(() => { vi.mocked(editorApi.search).mockResolvedValue(results); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("searches after typing, groups matches by file, and opens a match at its line", async () => {
  const onOpenMatch = vi.fn();
  render(<EditorSearchPage active repository={repository} onReturn={vi.fn()} onOpenMatch={onOpenMatch} />);
  expect(screen.getByText(/Type to search every text file/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search in files" }), { target: { value: "needle" } });
  expect(await screen.findByText("3 results in 2 files")).toBeInTheDocument();
  expect(editorApi.search).toHaveBeenCalledWith(4, "needle", { caseSensitive: false });
  expect(screen.getByText("app.ts")).toBeInTheDocument();
  expect(screen.getByText("guide.md")).toBeInTheDocument();
  expect(screen.getAllByText("needle", { selector: "mark" })).toHaveLength(2);
  expect(screen.getByText("Needle", { selector: "mark" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "src/app.ts line 9" }));
  expect(onOpenMatch).toHaveBeenCalledWith("src/app.ts", 9);
  fireEvent.click(screen.getByRole("button", { name: /app\.ts/ , expanded: true }));
  expect(screen.queryByRole("button", { name: "src/app.ts line 9" })).toBeNull();
});

it("re-runs with case sensitivity, reports truncation and errors, and clears on Escape", async () => {
  vi.mocked(editorApi.search).mockResolvedValueOnce({ ...results, truncated: true }).mockRejectedValueOnce(new Error("Search failed upstream."));
  render(<EditorSearchPage active repository={repository} onReturn={vi.fn()} onOpenMatch={vi.fn()} />);
  const input = screen.getByRole("searchbox", { name: "Search in files" });
  fireEvent.change(input, { target: { value: "needle" } });
  expect(await screen.findByText(/showing the first matches/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Match case" }));
  await waitFor(() => expect(editorApi.search).toHaveBeenLastCalledWith(4, "needle", { caseSensitive: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Search failed upstream.");
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveValue("");
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

it("is disabled without a project", () => {
  render(<EditorSearchPage active repository={null} onReturn={vi.fn()} onOpenMatch={vi.fn()} />);
  expect(screen.getByRole("searchbox", { name: "Search in files" })).toBeDisabled();
  expect(editorApi.search).not.toHaveBeenCalled();
});

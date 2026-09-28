import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fileApi } from "../api/fileApi";
import type { TreeNode } from "../types/domain";
import { FileInspector } from "./FileInspector";

vi.mock("../api/fileApi", () => ({
  fileApi: {
    getContent: vi.fn(),
    getSymbols: vi.fn(),
  },
}));

const file: TreeNode = {
  name: "main.py",
  path: "src/main.py",
  is_directory: false,
  language: "python",
  size_bytes: 24,
  file_id: 7,
  children: [],
};

describe("FileInspector", () => {
  beforeEach(() => {
    vi.mocked(fileApi.getContent).mockResolvedValue({
      file_id: 7,
      path: "src/main.py",
      content: "def main():\n    pass",
      is_binary: false,
      truncated: false,
    });
    vi.mocked(fileApi.getSymbols).mockResolvedValue([
      { id: 4, name: "main", kind: "function", parent_name: null, start_line: 1, end_line: 2 },
    ]);
  });

  it("renders indexed source and its symbol outline", async () => {
    render(<FileInspector file={file} onClose={vi.fn()} />);

    expect(await screen.findByText("def main():")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("function · line 1")).toBeInTheDocument();
    expect(fileApi.getContent).toHaveBeenCalledWith(7);
    expect(fileApi.getSymbols).toHaveBeenCalledWith(7);
  });
});

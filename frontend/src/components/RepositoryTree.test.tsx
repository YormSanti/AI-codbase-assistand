import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RepositoryTree } from "./RepositoryTree";
import type { TreeNode } from "../types/domain";

const sampleTree: TreeNode = {
  name: "myrepo",
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
          name: "main.py",
          path: "src/main.py",
          is_directory: false,
          language: "python",
          size_bytes: 120,
          file_id: 1,
          children: [],
        },
      ],
    },
    {
      name: "README.md",
      path: "README.md",
      is_directory: false,
      language: "markdown",
      size_bytes: 40,
      file_id: 2,
      children: [],
    },
  ],
};

describe("RepositoryTree", () => {
  it("renders top-level entries expanded by default", () => {
    render(<RepositoryTree root={sampleTree} />);

    expect(screen.getByText("myrepo")).toBeInTheDocument();
    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.getByText("README.md")).toBeInTheDocument();
  });

  it("keeps nested directories collapsed until clicked", async () => {
    const user = userEvent.setup();
    render(<RepositoryTree root={sampleTree} />);

    expect(screen.queryByText("main.py")).not.toBeInTheDocument();

    await user.click(screen.getByText("src"));

    expect(screen.getByText("main.py")).toBeInTheDocument();
  });

  it("shows the language tag for files", () => {
    render(<RepositoryTree root={sampleTree} />);

    expect(screen.getByText("markdown")).toBeInTheDocument();
  });

  it("reveals the selected file and supports opening it with the keyboard", async () => {
    const user = userEvent.setup();
    const onSelectFile = vi.fn();
    render(<RepositoryTree root={sampleTree} selectedFilePath="src/main.py" onSelectFile={onSelectFile} />);
    const file = screen.getByRole("treeitem", { name: "src/main.py" });
    expect(file).toHaveAttribute("aria-selected", "true");
    file.focus();
    await user.keyboard("{Enter}");
    expect(onSelectFile).toHaveBeenCalledWith(expect.objectContaining({ path: "src/main.py" }));
  });

  it("does not steal focus when a slash is typed in the code editor", async () => {
    const user = userEvent.setup();
    render(<><RepositoryTree root={sampleTree} /><textarea aria-label="Edit code" /></>);
    const editor = screen.getByRole("textbox", { name: "Edit code" });
    await user.click(editor);
    await user.keyboard("/");
    expect(editor).toHaveFocus();
    expect(editor).toHaveValue("/");
  });
});

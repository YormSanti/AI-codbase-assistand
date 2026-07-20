import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RepositoryTree } from "./RepositoryTree";
import type { TreeNode } from "../types/domain";

const sampleTree: TreeNode = {
  name: "myrepo",
  path: "",
  is_directory: true,
  language: null,
  size_bytes: null,
  children: [
    {
      name: "src",
      path: "src",
      is_directory: true,
      language: null,
      size_bytes: null,
      children: [
        {
          name: "main.py",
          path: "src/main.py",
          is_directory: false,
          language: "python",
          size_bytes: 120,
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
});

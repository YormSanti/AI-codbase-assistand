import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorExtensionsPage } from "./EditorExtensionsPage";
import * as extensionsData from "./extensionsData";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("EditorExtensionsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders curated extensions and header actions", () => {
    const onReturn = vi.fn();
    render(<EditorExtensionsPage active={true} onReturn={onReturn} />);

    expect(screen.getByText("Extensions")).toBeInTheDocument();
    expect(screen.getByText("Back to code")).toBeInTheDocument();
    expect(screen.getByText("Install from VSIX…")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search Extensions in Marketplace/i)).toBeInTheDocument();

    // Verify key curated extensions are shown
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("Prettier - Code Formatter")).toBeInTheDocument();
    expect(screen.getByText("ESLint")).toBeInTheDocument();
  });

  it("filters extensions by category tabs", () => {
    render(<EditorExtensionsPage active={true} onReturn={vi.fn()} />);

    // Click "Themes" category
    fireEvent.click(screen.getByRole("tab", { name: "Themes" }));
    expect(screen.getByText("Dracula Official")).toBeInTheDocument();
    expect(screen.getByText("One Dark Pro")).toBeInTheDocument();
    expect(screen.queryByText("Python")).not.toBeInTheDocument();

    // Click "Formatters & Linters"
    fireEvent.click(screen.getByRole("tab", { name: "Formatters & Linters" }));
    expect(screen.getByText("Prettier - Code Formatter")).toBeInTheDocument();
    expect(screen.getByText("ESLint")).toBeInTheDocument();
    expect(screen.queryByText("Dracula Official")).not.toBeInTheDocument();

    // Back to "All"
    fireEvent.click(screen.getByRole("tab", { name: "All" }));
    expect(screen.getByText("Python")).toBeInTheDocument();
  });

  it("installs and uninstalls an extension", async () => {
    render(<EditorExtensionsPage active={true} onReturn={vi.fn()} />);

    // Find Install button for Python
    const installPythonBtn = screen.getByRole("button", { name: "Install Python" });
    fireEvent.click(installPythonBtn);

    // Python is now installed
    expect(screen.getByText("Installed (1)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uninstall Python" })).toBeInTheDocument();

    // Switch to Installed tab
    fireEvent.click(screen.getByRole("tab", { name: "Installed (1)" }));
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.queryByText("ESLint")).not.toBeInTheDocument();

    // Uninstall Python
    fireEvent.click(screen.getByRole("button", { name: "Uninstall Python" }));
    expect(screen.getByText("Installed (0)")).toBeInTheDocument();
  });

  it("triggers download (.vsix) package", () => {
    const downloadSpy = vi.spyOn(extensionsData, "downloadExtensionVsix").mockImplementation(() => {});
    render(<EditorExtensionsPage active={true} onReturn={vi.fn()} />);

    const downloadBtn = screen.getByRole("button", { name: "Download Python" });
    fireEvent.click(downloadBtn);

    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringContaining("open-vsx.org"),
      expect.stringMatching(/python.*\.vsix$/)
    );
  });

  it("calls onReturn when 'Back to code' button is clicked", () => {
    const onReturn = vi.fn();
    render(<EditorExtensionsPage active={true} onReturn={onReturn} />);

    fireEvent.click(screen.getByRole("button", { name: "Back to code" }));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("opens extension details modal when card is clicked", () => {
    render(<EditorExtensionsPage active={true} onReturn={vi.fn()} />);

    fireEvent.click(screen.getByText("Prettier - Code Formatter"));
    expect(screen.getByRole("dialog", { name: "Extension Details" })).toBeInTheDocument();
    expect(screen.getByText("esbenp.prettier-vscode")).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeHealthPage } from "./CodeHealthPage";
import { healthApi } from "../api/healthApi";
import type { HealthReport } from "../types/domain";

vi.mock("../api/healthApi", () => ({ healthApi: { scan: vi.fn(), check: vi.fn() } }));

const repository = { id: 5, name: "shop", root_path: "/shop", current_branch: "main", head_commit: null, opened_at: null, file_count: 40 };
const report: HealthReport = {
  files_scanned: 38,
  truncated: false,
  counts: { secret: 1, risk: 2, marker: 1 },
  large_files: [{ path: "assets/data.json", size_bytes: 2_621_440 }],
  findings: [
    { category: "secret", rule: "aws-access-key", severity: "high", title: "AWS access key ID", path: "config/settings.py", line: 12, snippet: "AWS = 'AKIA…[redacted]'" },
    { category: "risk", rule: "shell-true", severity: "medium", title: "subprocess call with shell=True", path: "tools/run.py", line: 4, snippet: "subprocess.run(cmd, shell=True)" },
    { category: "risk", rule: "weak-hash", severity: "low", title: "MD5 or SHA-1 is too weak for security uses", path: "app/hash.py", line: 9, snippet: "hashlib.md5(data)" },
    { category: "marker", rule: "TODO", severity: "info", title: "TODO: remove legacy checkout", path: "app/cart.ts", line: 30, snippet: "// TODO: remove legacy checkout" },
  ],
};

beforeEach(() => { vi.mocked(healthApi.scan).mockResolvedValue(report); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("CodeHealthPage", () => {
  it("scans on open, starts on secrets, and switches categories", async () => {
    render(<CodeHealthPage repository={repository} onNavigate={vi.fn()} onOpenInEditor={vi.fn()} />);
    expect(await screen.findByText("AWS access key ID")).toBeInTheDocument();
    expect(healthApi.scan).toHaveBeenCalledWith(5);
    expect(screen.getByText("AWS = 'AKIA…[redacted]'")).toBeInTheDocument();
    expect(screen.getByText(/38 indexed text files scanned in shop/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Possible secrets/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /Risky patterns/ }));
    const risks = screen.getByRole("region", { name: "Risky patterns" });
    expect(within(risks).getByText("subprocess call with shell=True")).toBeInTheDocument();
    expect(within(risks).getByText("MD5 or SHA-1 is too weak for security uses")).toBeInTheDocument();
    expect(screen.queryByText("AWS access key ID")).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "Filter findings" }), { target: { value: "tools/" } });
    expect(within(risks).getByText("subprocess call with shell=True")).toBeInTheDocument();
    expect(within(risks).queryByText("MD5 or SHA-1 is too weak for security uses")).toBeNull();

    expect(screen.getByRole("region", { name: "Large files" })).toHaveTextContent("assets/data.json2.5 MB");
  });

  it("opens a finding in the editor at its line", async () => {
    const onOpenInEditor = vi.fn();
    render(<CodeHealthPage repository={repository} onNavigate={vi.fn()} onOpenInEditor={onOpenInEditor} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open config/settings.py at line 12" }));
    expect(onOpenInEditor).toHaveBeenCalledWith("config/settings.py", 12);
  });

  it("rescans, reports failures with a retry, and explains empty categories", async () => {
    vi.mocked(healthApi.scan)
      .mockResolvedValueOnce({ ...report, counts: { secret: 0, risk: 0, marker: 0 }, findings: [], large_files: [] })
      .mockRejectedValueOnce(new Error("No repository with id=5"))
      .mockResolvedValueOnce(report);
    render(<CodeHealthPage repository={repository} onNavigate={vi.fn()} onOpenInEditor={vi.fn()} />);
    expect(await screen.findByText("No hardcoded keys or credentials found.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rescan" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No repository with id=5");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("AWS access key ID")).toBeInTheDocument();
    expect(healthApi.scan).toHaveBeenCalledTimes(3);
  });

  it("asks for a project when none is open", () => {
    const onNavigate = vi.fn();
    render(<CodeHealthPage repository={null} onNavigate={onNavigate} onOpenInEditor={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open a project" }));
    expect(onNavigate).toHaveBeenCalledWith("explorer");
    expect(healthApi.scan).not.toHaveBeenCalled();
  });

  it("warns when the scan stopped early", async () => {
    vi.mocked(healthApi.scan).mockResolvedValue({ ...report, truncated: true });
    render(<CodeHealthPage repository={repository} onNavigate={vi.fn()} onOpenInEditor={vi.fn()} />);
    expect(await screen.findByText(/The scan stopped early/)).toBeInTheDocument();
    await waitFor(() => expect(healthApi.scan).toHaveBeenCalledTimes(1));
  });
});

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AIAgentPage } from "./AIAgentPage";
import { listen } from "@tauri-apps/api/event";
import { updateSettings } from "../hooks/useAppSettings";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));

afterEach(() => {
  localStorage.clear();
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  vi.clearAllMocks();
});

it("uses the saved provider and waits for a complete response when streaming is disabled", async () => {
  updateSettings({ defaultProvider: "codex", streamOutput: false });
  Object.assign(window, { __TAURI_INTERNALS__: {} });
  let reply!: (value: { content: string }) => void;
  invoke.mockImplementation((command: string) => command === "run_agent"
    ? new Promise(resolve => { reply = resolve; })
    : Promise.resolve({ installed: true, authenticated: true }));
  const user = userEvent.setup();
  render(<AIAgentPage repository={{ id: 1, name: "repo", root_path: "/repo", current_branch: "main", head_commit: null, opened_at: null, file_count: 1 }} />);
  await user.type(screen.getByPlaceholderText("Ask anything"), "Review the changes");
  await user.click(screen.getByTitle("Send instruction"));
  const request = invoke.mock.calls.find(([command]) => command === "run_agent")![1].request;
  expect(request.provider).toBe("codex");
  const streamHandler = vi.mocked(listen).mock.calls[0][1];
  act(() => streamHandler({ event: "agent-stream", id: 1, payload: { streamId: request.streamId, chunk: "partial response" } }));
  expect(screen.getByRole("log")).not.toHaveTextContent("partial response");
  await act(async () => { reply({ content: "Complete response" }); });
  expect(screen.getByRole("log")).toHaveTextContent("Complete response");
});

it("keeps replies, follow-ups, and errors in the original composer page", async () => {
  Object.assign(window, { __TAURI_INTERNALS__: {} });
  let reply!: (value: { content: string }) => void;
  invoke.mockImplementation((command: string) => command === "run_agent"
    ? new Promise(resolve => { reply = resolve; })
    : Promise.resolve({ installed: true, authenticated: true }));
  const user = userEvent.setup();
  render(<AIAgentPage repository={{ id: 1, name: "repo", root_path: "/repo", current_branch: "main", head_commit: null, opened_at: null, file_count: 1 }} />);
  const composer = screen.getByPlaceholderText("Ask anything");
  await user.type(composer, "Explain this project");
  await user.click(screen.getByTitle("Send instruction"));
  expect(screen.getByRole("log")).toHaveTextContent("Explain this project");
  expect(screen.getByRole("status")).toHaveTextContent("Waiting for a reply");
  expect(screen.getByPlaceholderText("Ask anything")).toBe(composer);
  await act(async () => { reply({ content: "This is the project explanation." }); });
  expect(screen.getByRole("log")).toHaveTextContent("This is the project explanation.");
  expect(composer).toHaveValue("");
  invoke.mockRejectedValueOnce(new Error("Provider unavailable"));
  await user.type(composer, "What should I change?");
  await user.click(screen.getByTitle("Send instruction"));
  expect(await screen.findByText("Provider unavailable")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Ask anything")).toBe(composer);
  expect(composer).toBeEnabled();
  expect(invoke).toHaveBeenLastCalledWith("run_agent", expect.objectContaining({
    request: expect.objectContaining({ prompt: expect.stringContaining("This is the project explanation.") }),
  }));
});

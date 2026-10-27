import { afterEach, expect, it, vi } from "vitest";
import { renameThreadIfDefault, titleFromPrompt } from "./useProjectSessions";

afterEach(() => localStorage.clear());

it("titles an untitled thread from the first line of its first message", () => {
  localStorage.setItem("threads_4", JSON.stringify([
    { id: "a", projectId: 4, title: "Session · 10/26/2026", createdAt: "2026-10-26" },
    { id: "b", projectId: 4, title: "Already named", createdAt: "2026-10-26" },
  ]));
  const changed = vi.fn();
  window.addEventListener("project-sessions-changed", changed);
  renameThreadIfDefault(4, "a", "  Why does   the build fail?\nDetails follow");
  renameThreadIfDefault(4, "b", "Should not rename");
  renameThreadIfDefault(4, "missing", "No such thread");
  window.removeEventListener("project-sessions-changed", changed);
  const threads = JSON.parse(localStorage.getItem("threads_4")!);
  expect(threads[0].title).toBe("Why does the build fail?");
  expect(threads[1].title).toBe("Already named");
  expect(changed).toHaveBeenCalledTimes(1);
});

it("shortens long titles", () => {
  expect(titleFromPrompt("x".repeat(80))).toBe(`${"x".repeat(47)}…`);
});

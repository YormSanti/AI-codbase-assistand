import { expect, it } from "vitest";
import { affectsPath } from "./fileEvents";

it("matches exact paths, repository-relative suffixes, and the any-file wildcard", () => {
  expect(affectsPath(["src/a.ts"], "src/a.ts")).toBe(true);
  expect(affectsPath(["frontend/src/a.ts"], "src/a.ts")).toBe(true);
  expect(affectsPath(["src/ab.ts"], "b.ts")).toBe(false);
  expect(affectsPath(["*"], "anything.md")).toBe(true);
  expect(affectsPath([], "src/a.ts")).toBe(false);
});

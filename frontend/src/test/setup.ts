import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Lazily loaded page chunks can take longer than the 1 s default to resolve
// when the whole suite runs in parallel on a loaded machine.
configure({ asyncUtilTimeout: 5000 });

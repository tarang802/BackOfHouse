import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest does not expose globals here, so unmount rendered trees explicitly.
afterEach(() => {
  cleanup();
});

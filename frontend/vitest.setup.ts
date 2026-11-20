import { cleanup } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, vi } from "vitest";

// Component specs opt into jsdom with a `// @vitest-environment jsdom` docblock; node specs skip the cleanup.
afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});

// next/link needs the app router; a plain anchor is all the specs need.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

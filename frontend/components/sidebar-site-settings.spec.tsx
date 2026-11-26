// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let pathname = "/site-settings/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { Sidebar } from "./sidebar";

describe("Sidebar: Site Settings tab", () => {
  it("has a Site Settings link next to Alerts, highlighted only on its own page", () => {
    pathname = "/site-settings/";
    const { unmount } = render(<Sidebar />);
    for (const l of screen.getAllByRole("link", { name: "Site Settings" })) {
      expect(l.getAttribute("href")).toBe("/site-settings/");
      expect(l.getAttribute("aria-current")).toBe("page");
    }
    for (const l of screen.getAllByRole("link", { name: "Alerts" })) expect(l.getAttribute("aria-current")).toBeNull();
    unmount();
    pathname = "/alerts/";
    render(<Sidebar />);
    for (const l of screen.getAllByRole("link", { name: "Site Settings" })) expect(l.getAttribute("aria-current")).toBeNull();
  });
});

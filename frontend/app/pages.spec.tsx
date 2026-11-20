// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/alerts",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace }),
}));
vi.mock("next/font/google", () => ({ Poppins: () => ({ variable: "poppins-var" }) }));
vi.mock("@/lib/session", () => ({ getToken: vi.fn(() => "tok") })); // a signed-in visitor: the gate lets the shell through
// The views have their own specs; the page shells only need to place them.
vi.mock("@/components/site-header", () => ({ SiteHeader: () => <div data-testid="header" />, SiteHeaderFallback: () => <div /> }));
vi.mock("./(app)/alerts/alerts-view", () => ({ AlertsView: () => <div data-testid="alerts-view" />, AlertsSkeleton: () => <div /> }));
vi.mock("./(app)/alert/alert-detail-view", () => ({ AlertDetailView: () => <div data-testid="detail-view" />, AlertDetailSkeleton: () => <div /> }));

import AppLayout from "./(app)/layout";
import AlertsPage from "./(app)/alerts/page";
import AlertPage from "./(app)/alert/page";
import LoginPage from "./(auth)/login/page";
import RootLayout from "./layout";
import Home from "./page";

describe("AppLayout", () => {
  it("wraps the page in a main landmark with a skip link, the navigation and the header", () => {
    render(<AppLayout><p>page body</p></AppLayout>);
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main");
    expect(screen.getByRole("main").id).toBe("main");
    expect(screen.getByRole("main").textContent).toBe("page body");
    expect(screen.getAllByRole("navigation", { name: "Main" }).length).toBeGreaterThan(0);
    expect(screen.getByTestId("header")).toBeTruthy();
  });
});

describe("pages", () => {
  it("the alerts page has its heading and streams the results in", () => {
    render(<AlertsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Alerts" })).toBeTruthy();
    expect(screen.getByTestId("alerts-view")).toBeTruthy();
  });

  it("the alert page renders the detail view", () => {
    render(<AlertPage />);
    expect(screen.getByTestId("detail-view")).toBeTruthy();
  });

  it("the login page has the welcome heading, the form and the logo", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getAllByText("Wear-Tech").length).toBeGreaterThan(0);
  });

  it("the home page sends the visitor to /alerts", () => {
    replace.mockClear();
    render(<Home />);
    expect(replace).toHaveBeenCalledWith("/alerts");
  });
});

describe("RootLayout", () => {
  it("renders an English document with the font variable and the page inside", () => {
    const tree = (RootLayout({ children: <p>hi</p> } as never)) as React.ReactElement<{ lang: string; className: string; children: React.ReactElement<{ children: unknown }> }>;
    expect(tree.type).toBe("html");
    expect(tree.props.lang).toBe("en");
    expect(tree.props.className).toContain("poppins-var");
    expect(tree.props.children.type).toBe("body");
  });

});

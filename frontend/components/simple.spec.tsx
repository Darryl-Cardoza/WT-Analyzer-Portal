// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("@/lib/auth", () => ({ logout: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({ ...(await original<typeof import("@/lib/api")>()), getMe: vi.fn() }));
vi.mock("@/lib/zone-pref", () => ({ useZoneChoice: vi.fn(), setZoneChoice: vi.fn() }));
let pathname = "/alerts";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ replace }) }));

import AppError from "@/app/(app)/error";
import NotFound from "@/app/not-found";
import { getMe, type Me } from "@/lib/api";
import { logout } from "@/lib/auth";
import { setZoneChoice, useZoneChoice } from "@/lib/zone-pref";
import { FalsePositiveBadge, StatusBadge, TypeTag } from "./badges";
import { ChipRow } from "./chip-row";
import { Card, CoordLink, Facts, Note, Stat } from "./detail";
import { Logo } from "./logo";
import { NotFoundPanel } from "./not-found-panel";
import { Sidebar, SidebarFallback } from "./sidebar";
import { SiteHeader, SiteHeaderFallback } from "./site-header";
import { ZoneToggle } from "./zone-toggle";

describe("badges", () => {
  it("TypeTag labels known types and humanizes unknown ones", () => {
    const { rerender } = render(<TypeTag type="DOOR_CHANGE" />);
    expect(screen.getByText("Door")).toBeTruthy();
    rerender(<TypeTag type="GEOFENCE" />);
    expect(screen.getByText("Nest")).toBeTruthy();
    rerender(<TypeTag type="AI_FALL_DETECTION" />);
    expect(screen.getByText("Fall")).toBeTruthy();
    rerender(<TypeTag type="LOW_BATTERY" />);
    expect(screen.getByText("Low Battery")).toBeTruthy();
    rerender(<TypeTag type="" />);
    expect(screen.getByText("Unknown")).toBeTruthy();
  });

  it("StatusBadge shows the status without underscores, with a tone per state", () => {
    const { rerender } = render(<StatusBadge status="RESOLVED" />);
    expect(screen.getByText("RESOLVED").className).toContain("text-ok-ink");
    rerender(<StatusBadge status="AUTO_ACKNOWLEDGED" />);
    expect(screen.getByText("AUTO ACKNOWLEDGED").className).toContain("text-brand-dark");
    rerender(<StatusBadge status="ACKNOWLEDGED" />);
    expect(screen.getByText("ACKNOWLEDGED").className).toContain("text-brand-dark");
    rerender(<StatusBadge status="OPEN" />);
    expect(screen.getByText("OPEN").className).toContain("text-muted");
    rerender(<StatusBadge status="" />);
    expect(screen.getByText("Unknown")).toBeTruthy();
  });

  it("FalsePositiveBadge: Yes, No, and a dash when never classified", () => {
    const { rerender } = render(<FalsePositiveBadge value={true} />);
    expect(screen.getByText("Yes").className).toContain("text-warn-ink");
    rerender(<FalsePositiveBadge value={false} />);
    expect(screen.getByText("No").className).toContain("text-ok-ink");
    rerender(<FalsePositiveBadge value={null} />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByText("Yes")).toBeNull();
  });
});

describe("ChipRow", () => {
  const chips = [
    { label: "All", href: "/alerts", active: false },
    { label: "Door", href: "/alerts?type=DOOR_CHANGE", active: true },
  ];
  it("renders each chip as a link and marks only the active one", () => {
    render(<ChipRow label="Type" chips={chips} />);
    expect(screen.getByRole("group", { name: "Filter by type" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "All" }).getAttribute("href")).toBe("/alerts");
    expect(screen.getByRole("link", { name: "Door" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: "All" }).getAttribute("aria-current")).toBeNull();
  });
  it("renders no links for no chips", () => {
    render(<ChipRow label="Status" chips={[]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("ZoneToggle", () => {
  it("shows UTC and the site label, pressed according to the current choice", () => {
    const { rerender } = render(<ZoneToggle choice="site" siteLabel="PST/PDT" />);
    expect(screen.getByRole("button", { name: "PST/PDT" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "UTC" }).getAttribute("aria-pressed")).toBe("false");
    rerender(<ZoneToggle choice="utc" siteLabel="PST/PDT" />);
    expect(screen.getByRole("button", { name: "UTC" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("stores the zone of the button that is clicked", async () => {
    vi.mocked(setZoneChoice).mockClear();
    render(<ZoneToggle choice="site" siteLabel="MST" />);
    await userEvent.click(screen.getByRole("button", { name: "UTC" }));
    expect(setZoneChoice).toHaveBeenLastCalledWith("utc");
    await userEvent.click(screen.getByRole("button", { name: "MST" }));
    expect(setZoneChoice).toHaveBeenLastCalledWith("site");
  });
  it("is plain buttons, not a form (there is no server to post to)", () => {
    const { container } = render(<ZoneToggle choice="site" siteLabel="MST" />);
    expect(container.querySelector("form")).toBeNull();
    for (const b of screen.getAllByRole("button")) expect(b.getAttribute("type")).toBe("button");
  });
});

describe("detail pieces", () => {
  it("Card shows its title and content", () => {
    render(<Card title="Summary">body text</Card>);
    expect(screen.getByRole("heading", { name: "Summary" })).toBeTruthy();
    expect(screen.getByText("body text")).toBeTruthy();
    expect(screen.queryByText("Total: 2")).toBeNull();
  });
  it("Card shows an optional aside beside the title", () => {
    render(<Card title="Summary" aside="Total: 2">body</Card>);
    expect(screen.getByText("Total: 2")).toBeTruthy();
  });
  it("Stat shows label, value and an optional hint", () => {
    const { rerender } = render(<Stat label="HDOP" value="1.2" hint="below threshold" tone="ok" />);
    expect(screen.getByText("HDOP")).toBeTruthy();
    expect(screen.getByText("1.2")).toBeTruthy();
    expect(screen.getByText("below threshold")).toBeTruthy();
    rerender(<Stat label="HDOP" value="1.2" />);
    expect(screen.queryByText("below threshold")).toBeNull();
  });
  it("Facts lists label/value pairs and a dash for empty values", () => {
    render(<Facts items={[["Device", "79058839"], ["Base", null]]} />);
    expect(screen.getByText("Device").nextElementSibling?.textContent).toBe("79058839");
    expect(screen.getByText("Base").nextElementSibling?.textContent).toBe("—");
  });
  it("Note renders its text", () => {
    render(<Note>heads up</Note>);
    expect(screen.getByText("heads up")).toBeTruthy();
  });
  it("CoordLink links to a map in a new tab, or shows a dash without a coordinate", () => {
    const { rerender } = render(<CoordLink coord={{ lat: 38.62, lon: -121.25 }} />);
    const a = screen.getByRole("link", { name: "38.620000, -121.250000" });
    expect(a.getAttribute("href")).toContain("mlat=38.62&mlon=-121.25");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
    rerender(<CoordLink coord={null} />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("Sidebar", () => {
  it.each(["/alerts/", "/alerts", "/alert/", "/alert"])("highlights Alerts on %s (the list and the detail page), in both the phone bar and the sidebar", (path) => {
    pathname = path;
    render(<Sidebar />);
    const links = screen.getAllByRole("link", { name: "Alerts" });
    expect(links).toHaveLength(2);
    for (const l of links) expect(l.getAttribute("aria-current")).toBe("page");
  });
  it("does not highlight look-alike paths", () => {
    pathname = "/alertsx/";
    render(<Sidebar />);
    for (const l of screen.getAllByRole("link", { name: "Alerts" })) expect(l.getAttribute("aria-current")).toBeNull();
  });
  it("highlights nothing on another path and in the fallback", () => {
    pathname = "/login";
    const { unmount } = render(<Sidebar />);
    for (const l of screen.getAllByRole("link", { name: "Alerts" })) expect(l.getAttribute("aria-current")).toBeNull();
    unmount();
    render(<SidebarFallback />);
    for (const l of screen.getAllByRole("link", { name: "Alerts" })) expect(l.getAttribute("aria-current")).toBeNull();
  });
});

describe("SiteHeader", () => {
  const me = (site: Me["site"]) => ({ weartechUserId: "admin@site.org", site });
  it("shows the site, its zone, the admin, the toggle and Sign out", async () => {
    vi.mocked(getMe).mockResolvedValue(me({ id: "1", name: "Eskaton Gold River", timeZone: "America/Los_Angeles" }));
    vi.mocked(useZoneChoice).mockReturnValue("site");
    render(<SiteHeader />);
    expect(await screen.findByText("Eskaton Gold River")).toBeTruthy();
    expect(screen.getByText("Times shown in PST/PDT (America/Los_Angeles)")).toBeTruthy();
    expect(screen.getByText("admin@site.org")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Time zone" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });
  it("says UTC when UTC is chosen, and falls back to 'Your site' without a name", async () => {
    vi.mocked(getMe).mockResolvedValue(me({ id: "1", name: null, timeZone: "America/Phoenix" }));
    vi.mocked(useZoneChoice).mockReturnValue("utc");
    render(<SiteHeader />);
    expect(await screen.findByText("Your site")).toBeTruthy();
    expect(screen.getByText("Times shown in UTC")).toBeTruthy();
    expect(screen.getByRole("button", { name: "UTC" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("Sign out ends the session and goes to the login page", async () => {
    vi.mocked(getMe).mockResolvedValue(me({ id: "1", name: "X", timeZone: "UTC" }));
    vi.mocked(useZoneChoice).mockReturnValue("site");
    vi.mocked(logout).mockClear();
    replace.mockClear();
    render(<SiteHeader />);
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login");
  });
  it("shows the placeholder, not a half-filled header, until the site is known", () => {
    vi.mocked(getMe).mockReturnValue(new Promise(() => undefined));
    vi.mocked(useZoneChoice).mockReturnValue("site");
    const { container } = render(<SiteHeader />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });
  it("the fallback is an empty hidden placeholder", () => {
    const { container } = render(<SiteHeaderFallback />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("static panels", () => {
  it("NotFoundPanel links back to the alerts", () => {
    render(<NotFoundPanel />);
    expect(screen.getByRole("heading", { name: "Not found" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to alerts" }).getAttribute("href")).toBe("/alerts/");
  });
  it("the app error boundary offers Try again, which calls retry", async () => {
    const retry = vi.fn();
    render(<AppError error={new Error("x")} retry={retry} />);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
  it("the 404 page shows the logo and a link to the alerts", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to alerts" }).getAttribute("href")).toBe("/alerts/");
    expect(screen.getByText("Alert Analyzer")).toBeTruthy();
  });
  it("Logo shows the product name", () => {
    render(<Logo />);
    expect(within(document.body).getByText("Wear-Tech")).toBeTruthy();
  });
});

describe("SiteHeader: site zone changed elsewhere", () => {
  it("loads /me again and shows the new zone, without a page reload", async () => {
    vi.mocked(useZoneChoice).mockReturnValue("site");
    vi.mocked(getMe).mockReset();
    vi.mocked(getMe).mockResolvedValueOnce({ weartechUserId: "a@b.org", site: { id: "1", name: "Gordon Manor", timeZone: "Asia/Kolkata" } });
    render(<SiteHeader />);
    expect(await screen.findByText(/Asia\/Kolkata/)).toBeTruthy();
    vi.mocked(getMe).mockResolvedValueOnce({ weartechUserId: "a@b.org", site: { id: "1", name: "Gordon Manor", timeZone: "America/Anchorage" } });
    window.dispatchEvent(new Event("analyzer:me-changed"));
    expect(await screen.findByText(/America\/Anchorage/)).toBeTruthy();
    expect(screen.getByText("Gordon Manor")).toBeTruthy(); // the header stayed up while it reloaded
  });
});

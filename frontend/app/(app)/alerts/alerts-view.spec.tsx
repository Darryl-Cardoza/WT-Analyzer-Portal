// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import { Component } from "react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertSummary, SearchResponse } from "@/lib/alerts";

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }
  class SessionError extends Error {}
  return { ApiError, SessionError, getMe: vi.fn(), searchAlerts: vi.fn() };
});
vi.mock("@/lib/zone-pref", () => ({ useZoneChoice: vi.fn() }));
let query = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => query, useRouter: () => ({ replace: vi.fn() }) }));

import { ApiError, getMe, searchAlerts } from "@/lib/api";
import { useZoneChoice } from "@/lib/zone-pref";
import { AlertsSkeleton, AlertsView } from "./alerts-view";

const alert = (n: number, over: Partial<AlertSummary> = {}): AlertSummary => ({
  id: `id${n}`,
  alertType: "DOOR_CHANGE",
  alertStatus: "RESOLVED",
  alertTitle: `Door ${n} change detected`,
  resident: `resident${n}@site.org`,
  residentName: null,
  startedAt: "2026-11-11T21:24:29.970Z",
  endedAt: null,
  isFalsePositive: null,
  source: null,
  ...over,
});
const reply = (alerts: AlertSummary[], timeZone = "America/Los_Angeles"): SearchResponse => ({ timeZone, count: alerts.length, alerts });
const setQuery = (sp: Record<string, string | undefined>) => {
  query = new URLSearchParams();
  for (const [k, v] of Object.entries({ date: "2026-11-11", ...sp })) if (v !== undefined) query.set(k, v);
};
// Resolves once the results are on screen: the search form only appears after both requests have answered.
const view = async (sp: Record<string, string | undefined> = {}) => {
  setQuery(sp);
  const utils = render(<AlertsView />);
  await screen.findByRole("button", { name: "Search" });
  return utils;
};
// What the app's error page does: catches what the view throws.
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? <p>caught: {this.state.error.message}</p> : this.props.children;
  }
}
const row = (i: number) => screen.getAllByRole("row")[i + 1];
const group = (name: string) => screen.getByRole("group", { name });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMe).mockResolvedValue({ weartechUserId: "a@b.c", site: { id: "1", name: "Site", timeZone: "America/Los_Angeles" } });
  vi.mocked(useZoneChoice).mockReturnValue("site");
  vi.mocked(searchAlerts).mockResolvedValue(reply([]));
});

describe("AlertsView: search form", () => {
  it("fills the form from the URL and searches the API with it", async () => {
    await view({ email: "r@site.org", date: "2026-11-11", time: "13:00" });
    expect((screen.getByLabelText(/Resident email/) as HTMLInputElement).defaultValue).toBe("r@site.org");
    expect((screen.getByLabelText(/From date/) as HTMLInputElement).defaultValue).toBe("2026-11-11");
    expect((screen.getByLabelText(/From time/) as HTMLInputElement).defaultValue).toBe("13:00");
    expect(searchAlerts).toHaveBeenCalledWith({ email: "r@site.org", date: "2026-11-11", time: "13:00", tz: "America/Los_Angeles" });
  });

  it("defaults the date to today in the display zone", async () => {
    query = new URLSearchParams(); // no date in the URL
    render(<AlertsView />);
    await screen.findByRole("button", { name: "Search" });
    expect(vi.mocked(searchAlerts).mock.calls[0][0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("with a to-date, searches a range", async () => {
    await view({ date: "2026-11-11", toDate: "2026-11-12", toTime: "08:00" });
    expect(searchAlerts).toHaveBeenCalledWith({ email: undefined, from: "2026-11-11T00:00", to: "2026-11-12T08:00", tz: "America/Los_Angeles" });
  });

  it("reads the search in UTC when UTC is chosen", async () => {
    vi.mocked(useZoneChoice).mockReturnValue("utc");
    await view({ time: "13:00" });
    expect(searchAlerts).toHaveBeenCalledWith({ email: undefined, date: "2026-11-11", time: "13:00", tz: "UTC" });
  });

  it("keeps the active filters as hidden fields so a new search does not lose them", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply([alert(1)]));
    const { container } = await view({ type: "DOOR_CHANGE", status: "RESOLVED" });
    expect(container.querySelector('input[type="hidden"][name="type"]')?.getAttribute("value")).toBe("DOOR_CHANGE");
    expect(container.querySelector('input[type="hidden"][name="status"]')?.getAttribute("value")).toBe("RESOLVED");
    expect(container.querySelector('input[type="hidden"][name="source"]')).toBeNull();
  });
});

describe("AlertsView: result summary", () => {
  it("counts the alerts for a day, singular and plural", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply([alert(1)]));
    const { unmount } = await view();
    expect(screen.getByText(/alert on/).textContent).toBe("Total 1 alert on Nov 11, 2026");
    unmount();
    vi.mocked(searchAlerts).mockResolvedValue(reply([alert(1), alert(2)]));
    await view();
    expect(screen.getByText(/alerts on/).textContent).toBe("Total 2 alerts on Nov 11, 2026");
  });

  it("mentions the time window, the resident and a range", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply([alert(1)]));
    const { unmount } = await view({ time: "13:00", email: "r@site.org" });
    expect(screen.getByText(/alert on/).textContent).toBe("Total 1 alert on Nov 11, 2026 around 13:00 for r@site.org");
    unmount();
    await view({ date: "2026-11-11", time: "09:00", toDate: "2026-11-12", toTime: "17:00" });
    expect(screen.getByText(/alert from/).textContent).toBe("Total 1 alert from Nov 11, 2026 09:00 to Nov 12, 2026 17:00");
  });

  it("says search times and results are in UTC when UTC is chosen", async () => {
    vi.mocked(useZoneChoice).mockReturnValue("utc");
    await view();
    expect(screen.getByText("Search times and results are in UTC.")).toBeTruthy();
  });

  it("says they are in the site zone (PST/PDT) in site time", async () => {
    await view();
    expect(screen.getByText("Search times and results are in PST/PDT.")).toBeTruthy();
  });
});

describe("AlertsView: results table", () => {
  it("shows type, status, source, resident, time, summary link and false-positive for each alert", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(
      reply([
        alert(1, { alertType: "GEOFENCE", alertStatus: "AUTO_ACKNOWLEDGED", source: "BLE", residentName: "Jane Smith", isFalsePositive: true, alertTitle: "Geofence breach" }),
        alert(2, { alertTitle: null }),
      ]),
    );
    await view();
    const first = within(row(0)).getAllByRole("cell");
    expect(first[0].textContent).toBe("Nest");
    expect(first[1].textContent).toBe("AUTO ACKNOWLEDGED");
    expect(first[2].textContent).toBe("BLE");
    expect(first[3].textContent).toBe("Jane Smithresident1@site.org");
    expect(first[4].textContent).toBe("Nov 11, 1:24 PM");
    expect(first[5].textContent).toBe("Geofence breach");
    expect(first[6].textContent).toBe("Yes");
    const second = within(row(1)).getAllByRole("cell");
    expect(second[2].textContent).toBe("—"); // no source
    expect(second[3].textContent).toBe("resident2@site.org"); // no name: just the id
    expect(second[5].textContent).toBe("Open alert");
    expect(second[6].textContent).toBe("—");
  });

  it("shows times in UTC when chosen", async () => {
    vi.mocked(useZoneChoice).mockReturnValue("utc");
    vi.mocked(searchAlerts).mockResolvedValue(reply([alert(1)]));
    await view();
    expect(within(row(0)).getAllByRole("cell")[4].textContent).toBe("Nov 11, 9:24 PM UTC");
  });

  it("links each alert to its detail page, carrying the search so Back returns to it", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply([alert(1)]));
    await view({ email: "r@site.org", type: "DOOR_CHANGE" });
    const href = screen.getByRole("link", { name: "Door 1 change detected" }).getAttribute("href")!;
    expect(href.startsWith("/alert/?id=id1&from=")).toBe(true);
    const from = new URLSearchParams(new URL(href, "http://x").searchParams.get("from")!);
    expect(from.get("email")).toBe("r@site.org");
    expect(from.get("type")).toBe("DOOR_CHANGE");
  });

  it("says 'No alerts match this search.' when the API returns nothing, and shows no chips", async () => {
    await view();
    expect(screen.getByText("No alerts match this search.")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Filter by type" })).toBeNull();
    expect(screen.getByText("Filtered (0 of 0)")).toBeTruthy();
  });
});

describe("AlertsView: filters", () => {
  const mixed = [
    alert(1, { alertType: "DOOR_CHANGE", alertStatus: "RESOLVED" }),
    alert(2, { alertType: "AI_FALL_DETECTION", alertStatus: "ACKNOWLEDGED", isFalsePositive: false }),
    alert(3, { alertType: "GEOFENCE", alertStatus: "RESOLVED", source: "LTE", isFalsePositive: true }),
  ];

  it("shows a chip row per filter, with All active by default", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply(mixed));
    await view();
    const type = within(group("Filter by type"));
    expect(type.getAllByRole("link").map((l) => l.textContent)).toEqual(["All Types", "Door", "Nest", "Fall"]);
    expect(type.getByRole("link", { name: "All Types" }).getAttribute("aria-current")).toBe("true");
    expect(within(group("Filter by status")).getAllByRole("link").map((l) => l.textContent)).toEqual(expect.arrayContaining(["All", "Resolved", "Acknowledged"]));
    expect(within(group("Filter by source")).getAllByRole("link").map((l) => l.textContent)).toEqual(expect.arrayContaining(["All", "LTE"]));
    expect(group("Filter by false positive")).toBeTruthy();
  });

  it("only shows the Source row when the result has a source", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply([mixed[0], mixed[1]]));
    await view();
    expect(screen.queryByRole("group", { name: "Filter by source" })).toBeNull();
  });

  it("filters the table by type and marks that chip active", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply(mixed));
    await view({ type: "GEOFENCE" });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(within(row(0)).getAllByRole("cell")[0].textContent).toBe("Nest");
    expect(within(group("Filter by type")).getByRole("link", { name: "Nest" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByText("Filtered (1 of 3)")).toBeTruthy();
  });

  it("filters by status and by source", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply(mixed));
    const { unmount } = await view({ status: "ACKNOWLEDGED" });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    unmount();
    await view({ source: "LTE" });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(within(row(0)).getAllByRole("cell")[2].textContent).toBe("LTE");
  });

  it("builds chip links that keep the other filters and the search", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply(mixed));
    await view({ type: "GEOFENCE", email: "r@site.org" });
    const doorHref = within(group("Filter by type")).getByRole("link", { name: "Door" }).getAttribute("href")!;
    expect(doorHref).toContain("type=DOOR_CHANGE");
    expect(doorHref).toContain("email=r%40site.org");
    const allHref = within(group("Filter by type")).getByRole("link", { name: "All Types" }).getAttribute("href")!;
    expect(allHref).not.toContain("type=");
  });

  it("ignores an unknown type in the URL", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply(mixed));
    await view({ type: "BOGUS" });
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });

  it("says 'No alerts match these filters.' when the filters remove everything", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply([mixed[0]]));
    await view({ type: "GEOFENCE" });
    expect(screen.getByText("No alerts match these filters.")).toBeTruthy();
    expect(screen.getByText("Filtered (0 of 1)")).toBeTruthy();
  });
});

describe("AlertsView: pagination", () => {
  const many = Array.from({ length: 65 }, (_, i) => alert(i));

  it("shows 30 per page with the range and a Next link only on the first page", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply(many));
    await view();
    expect(screen.getAllByRole("row")).toHaveLength(31);
    expect(screen.getByText("· showing 1–30")).toBeTruthy();
    const nav = within(screen.getByRole("navigation", { name: "Pagination" }));
    expect(nav.getByText("Page 1 of 3")).toBeTruthy();
    expect(nav.queryByRole("link", { name: "Previous" })).toBeNull();
    expect(nav.getByRole("link", { name: "Next" }).getAttribute("href")).toContain("page=2");
  });

  it("the last page shows the remainder and a Previous link only", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply(many));
    await view({ page: "3" });
    expect(screen.getAllByRole("row")).toHaveLength(6);
    expect(screen.getByText("· showing 61–65")).toBeTruthy();
    const nav = within(screen.getByRole("navigation", { name: "Pagination" }));
    expect(nav.queryByRole("link", { name: "Next" })).toBeNull();
    expect(nav.getByRole("link", { name: "Previous" }).getAttribute("href")).toContain("page=2");
  });

  it("Previous from page 2 drops the page parameter", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply(many));
    await view({ page: "2" });
    expect(within(screen.getByRole("navigation", { name: "Pagination" })).getByRole("link", { name: "Previous" }).getAttribute("href")).not.toContain("page=");
  });

  it("has no pager for one page", async () => {
    vi.mocked(searchAlerts).mockResolvedValue(reply([alert(1)]));
    await view();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });
});

describe("AlertsView: errors", () => {
  it("shows the API's message for a 400 (a bad date or time), with no results", async () => {
    vi.mocked(searchAlerts).mockRejectedValue(new ApiError(400, "date must be yyyy-MM-dd"));
    await view({ date: "nope" });
    expect(screen.getByRole("alert").textContent).toBe("date must be yyyy-MM-dd");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy(); // the form is still there to fix it
  });

  it.each([new ApiError(500, "boom"), new Error("network")])("throws %s so the error page handles it", async (error) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined); // React logs the caught error
    vi.mocked(searchAlerts).mockRejectedValue(error);
    setQuery({});
    render(<Boundary><AlertsView /></Boundary>);
    expect(await screen.findByText(`caught: ${error.message}`)).toBeTruthy();
  });

  it("throws a failure to load the site too (not just the search)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getMe).mockRejectedValue(new Error("me failed"));
    setQuery({});
    render(<Boundary><AlertsView /></Boundary>);
    expect(await screen.findByText("caught: me failed")).toBeTruthy();
  });

  it("shows the busy placeholder until the site and the results are in, and never the form before", async () => {
    vi.mocked(searchAlerts).mockReturnValue(new Promise(() => undefined));
    setQuery({});
    const { container } = render(<AlertsView />);
    const busy = () => container.querySelector('[aria-busy="true"]');
    expect(busy()).toBeTruthy(); // the site is not known yet
    await waitFor(() => expect(searchAlerts).toHaveBeenCalled()); // the site is in, the results are not
    expect(busy()).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
  });
});

describe("AlertsSkeleton", () => {
  it("renders a busy placeholder", () => {
    const { container } = render(<AlertsSkeleton />);
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
  });
});

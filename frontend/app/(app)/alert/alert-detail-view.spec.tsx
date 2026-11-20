// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Component } from "react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertDetail } from "@/lib/alerts";

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }
  class SessionError extends Error {}
  return { ApiError, SessionError, getAlert: vi.fn() };
});
vi.mock("@/lib/zone-pref", () => ({ useZoneChoice: vi.fn() }));
let query = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => query, useRouter: () => ({ replace: vi.fn() }) }));
// The sections have their own specs; here they only show which one was chosen and which zone it got.
vi.mock("@/components/fall-analysis", () => ({ FallSection: ({ timeZone }: { timeZone: string }) => <div data-testid="fall" data-zone={timeZone} /> }));
vi.mock("@/components/door-analysis", () => ({ DoorSection: () => <div data-testid="door" /> }));
vi.mock("@/components/geofence-analysis", () => ({ GeofenceSection: () => <div data-testid="geofence" /> }));

import { ApiError, getAlert } from "@/lib/api";
import { useZoneChoice } from "@/lib/zone-pref";
import { AlertDetailSkeleton, AlertDetailView } from "./alert-detail-view";

type Over = { timeZone?: string; analysis?: unknown; alert?: Partial<AlertDetail["alert"]>; resident?: Partial<AlertDetail["resident"]> };
const detail = (over: Over = {}): AlertDetail => ({
  timeZone: over.timeZone ?? "America/Los_Angeles",
  analysis: ("analysis" in over ? over.analysis : { type: "FALL" }) as AlertDetail["analysis"],
  alert: {
    id: "abc123",
    alertType: "AI_FALL_DETECTION",
    alertStatus: "RESOLVED",
    alertTitle: "Soft Fall - 90% probability",
    resident: "resident9@site.org",
    residentName: null,
    startedAt: "2026-11-11T21:24:29Z",
    endedAt: "2026-11-11T21:25:10Z",
    isFalsePositive: true,
    source: null,
    deviceId: "79058839",
    acknowledgment: { acknowledged: true, acknowledgedAt: "2026-11-11T21:24:40Z", completedAt: "2026-11-11T21:25:10Z", notes: "Resident was fine", acknowledgedBy: "noc@site.org" },
    ...over.alert,
  },
  resident: { weartechUserId: "resident9@site.org", deviceId: "dev-r", fallProfile: "low", baseLocation: null, name: null, ...over.resident },
});
const setQuery = (params: Record<string, string>) => {
  query = new URLSearchParams(params);
};
// Resolves once the alert is on screen (the page heading only appears after the request has answered).
const view = async (data: AlertDetail, from?: string) => {
  vi.mocked(getAlert).mockResolvedValue(data);
  setQuery({ id: "abc123", ...(from ? { from } : {}) });
  const utils = render(<AlertDetailView />);
  await screen.findByRole("heading", { level: 1 });
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
const fact = (label: string) => screen.getByText(label).nextElementSibling!.textContent;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useZoneChoice).mockReturnValue("site");
});

describe("AlertDetailView: header", () => {
  it("shows type, status, false-positive, title and the facts", async () => {
    await view(detail());
    expect(screen.getByText("Fall")).toBeTruthy();
    expect(screen.getByText("RESOLVED")).toBeTruthy();
    expect(screen.getByText("False positive").textContent).toBe("False positive Yes");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Soft Fall - 90% probability");
    expect(fact("Resident")).toBe("resident9@site.org");
    expect(fact("Started")).toBe("Nov 11, 1:24 PM");
    expect(fact("Ended")).toBe("Nov 11, 1:25 PM (41s)");
    expect(fact("Device")).toBe("79058839");
    expect(fact("Alert ID")).toBe("abc123");
  });

  it("shows the resident's name above the id when it is known", async () => {
    await view(detail({ resident: { name: "Jane Smith" } }));
    expect(fact("Resident")).toBe("Jane Smithresident9@site.org");
  });

  it("omits the false-positive badge when never classified, uses a default title, and dashes for no end / the resident's device", async () => {
    await view(detail({ alert: { isFalsePositive: null, alertTitle: null, endedAt: null, deviceId: null } }));
    expect(screen.queryByText("False positive")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Alert");
    expect(fact("Ended")).toBe("—");
    expect(fact("Device")).toBe("dev-r");
  });

  it("omits the duration when the end is before the start", async () => {
    await view(detail({ alert: { endedAt: "2026-11-11T21:00:00Z" } }));
    expect(fact("Ended")).toBe("Nov 11, 1:00 PM");
  });

  it("shows times in UTC when chosen, and passes that zone to the section", async () => {
    vi.mocked(useZoneChoice).mockReturnValue("utc");
    await view(detail());
    expect(fact("Started")).toBe("Nov 11, 9:24 PM UTC");
    expect(screen.getByTestId("fall").getAttribute("data-zone")).toBe("UTC");
  });
});

describe("AlertDetailView: back link", () => {
  it("goes back to the search that led here", async () => {
    await view(detail(), "email=r%40site.org&type=DOOR_CHANGE&page=2");
    const href = screen.getByRole("link", { name: "← Back to results" }).getAttribute("href")!;
    expect(href).toContain("email=r%40site.org");
    expect(href).toContain("type=DOOR_CHANGE");
    expect(href).toContain("page=2");
  });
  it("goes to /alerts/ without a search", async () => {
    await view(detail());
    expect(screen.getByRole("link", { name: "← Back to results" }).getAttribute("href")).toBe("/alerts/");
  });
});

describe("AlertDetailView: analysis", () => {
  it.each([
    ["FALL", "fall"],
    ["DOOR", "door"],
    ["GEOFENCE", "geofence"],
  ])("%s analysis renders only the %s section", async (type, id) => {
    await view(detail({ analysis: { type } as never }));
    for (const other of ["fall", "door", "geofence"]) expect(screen.queryByTestId(other) !== null).toBe(other === id);
    expect(screen.queryByText(/No detailed analysis/)).toBeNull();
  });

  it("says so when the alert type has no analysis", async () => {
    await view(detail({ analysis: null }));
    expect(screen.getByText("No detailed analysis is available for this alert type.")).toBeTruthy();
    for (const id of ["fall", "door", "geofence"]) expect(screen.queryByTestId(id)).toBeNull();
  });
});

describe("AlertDetailView: acknowledgement card", () => {
  it("shows who acknowledged, when, and the notes", async () => {
    await view(detail());
    expect(fact("Acknowledged")).toBe("Yes");
    expect(fact("Acknowledged at")).toBe("Nov 11, 1:24 PM");
    expect(fact("Acknowledged / closed by")).toBe("noc@site.org");
    expect(fact("Completed at")).toBe("Nov 11, 1:25 PM");
    expect(fact("Notes")).toBe("Resident was fine");
  });

  it("shows No / dashes for an unacknowledged alert and blank notes", async () => {
    await view(detail({ alert: { acknowledgment: { acknowledged: false, acknowledgedAt: null, completedAt: null, notes: "   ", acknowledgedBy: null } } }));
    expect(fact("Acknowledged")).toBe("No");
    expect(fact("Acknowledged at")).toBe("—");
    expect(fact("Acknowledged / closed by")).toBe("—");
    expect(fact("Completed at")).toBe("—");
    expect(fact("Notes")).toBe("—");
  });

  it("shows a dash when acknowledged is unknown", async () => {
    await view(detail({ alert: { acknowledgment: { acknowledged: null, acknowledgedAt: null, completedAt: null, notes: null, acknowledgedBy: null } } }));
    expect(fact("Acknowledged")).toBe("—");
  });
});

describe("AlertDetailView: errors", () => {
  it.each([404, 400])("a %i shows the not-found panel", async (status) => {
    vi.mocked(getAlert).mockRejectedValue(new ApiError(status, "x"));
    setQuery({ id: "x" });
    render(<AlertDetailView />);
    expect(await screen.findByRole("heading", { name: "Not found" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1, name: "Alert" })).toBeNull();
  });

  it("shows the not-found panel, without asking the API, when the URL has no alert id", async () => {
    setQuery({});
    render(<AlertDetailView />);
    expect(await screen.findByRole("heading", { name: "Not found" })).toBeTruthy();
    expect(getAlert).not.toHaveBeenCalled();
  });

  it.each([new ApiError(500, "boom"), new Error("network")])("throws %s so the error page handles it", async (error) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined); // React logs the caught error
    vi.mocked(getAlert).mockRejectedValue(error);
    setQuery({ id: "x" });
    render(<Boundary><AlertDetailView /></Boundary>);
    expect(await screen.findByText(`caught: ${error.message}`)).toBeTruthy();
  });

  it("shows the busy placeholder while the alert loads", () => {
    vi.mocked(getAlert).mockReturnValue(new Promise(() => undefined));
    setQuery({ id: "abc123" });
    const { container } = render(<AlertDetailView />);
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
  });

  it("asks the API for the alert in the URL", async () => {
    await view(detail());
    expect(getAlert).toHaveBeenCalledWith("abc123");
  });
});

describe("AlertDetailSkeleton", () => {
  it("renders a busy placeholder", () => {
    const { container } = render(<AlertDetailSkeleton />);
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
  });
});

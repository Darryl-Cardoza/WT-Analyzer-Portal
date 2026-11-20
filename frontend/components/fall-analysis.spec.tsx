// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FallAnalysis, FallPacket } from "@/lib/alerts";

// The real map needs Google; the stub just reports what it was given.
vi.mock("@/components/fall-map", () => ({
  FallMap: ({ pins, nests }: { pins: { title: string; lines: string[] }[]; nests?: unknown[] }) => (
    <div data-testid="fall-map" data-nests={nests?.length ?? 0}>
      {pins.map((p, i) => (
        <span key={i} data-testid="pin" data-title={p.title} data-lines={p.lines.join("|")} />
      ))}
    </div>
  ),
}));

import { FallSection } from "./fall-analysis";

const TZ = "America/Los_Angeles";
const loc = { lat: 38.62, lon: -121.25 };
const base: FallAnalysis = {
  type: "FALL",
  parsed: true,
  fallKind: "soft",
  probability: 90,
  residentRisk: "low",
  threshold: 85,
  meetsThreshold: true,
  alertLocation: loc,
  baseLocation: { lat: 38.6, lon: -121.2 },
  distanceFromBaseMeters: 1250,
  isFalsePositive: true,
  recentFalls: [],
  packets: [],
  resolution: {
    status: "RESOLVED",
    seconds: 118,
    resolvedAt: "2026-11-11T21:26:27Z",
    exceededLimit: false,
    limitSeconds: 10800,
    completedAt: "2026-11-11T21:25:10Z",
    completedSeconds: 41,
  },
  acknowledgedAt: "2026-11-11T21:24:40Z",
  acknowledgedSeconds: 11,
  notes: [],
};
const show = (over: Partial<FallAnalysis> = {}) => render(<FallSection analysis={{ ...base, ...over }} timeZone={TZ} />);
const stat = (label: string) => screen.getByText(label).parentElement!;
const packet = (i: number, over: Partial<FallPacket> = {}): FallPacket => ({
  category: "ALERT",
  packetTimestamp: new Date(Date.UTC(2026, 10, 11, 21, 24, 29 + i)).toISOString(),
  offsetSeconds: i,
  alertBit: "000100000",
  payloadType: "LTE",
  deviceId: "79058839",
  latitude: 38.6,
  longitude: -121.2,
  sensorDocumentId: "d",
  ...over,
});

describe("FallSection: verdict", () => {
  it("shows type, probability, risk, threshold and Meets threshold", () => {
    show();
    expect(stat("Type").textContent).toContain("Soft");
    expect(stat("Probability").textContent).toContain("90%");
    expect(stat("Resident risk").textContent).toContain("Low");
    expect(stat("Site threshold").textContent).toContain("85%");
    expect(stat("Site threshold").textContent).toContain("Soft fall, low risk");
    expect(stat("Verdict").textContent).toContain("Meets threshold");
    expect(stat("Verdict").textContent).toContain("Soft fall at 90% against the low-risk threshold of 85%");
  });

  it("shows Below threshold when the probability is under the threshold", () => {
    show({ meetsThreshold: false, probability: 80 });
    expect(stat("Verdict").textContent).toContain("Below threshold");
  });

  it.each([
    ["the title is unparsed", { parsed: false, fallKind: null, probability: null, meetsThreshold: null, threshold: null }, "could not be read"],
    ["the resident has no risk level", { residentRisk: null, meetsThreshold: null, threshold: null }, "no fall risk level set"],
    ["the site has no threshold", { meetsThreshold: null, threshold: null }, "no soft fall threshold for low risk residents"],
  ])("says why there is no verdict when %s", (_n, over, text) => {
    show(over as Partial<FallAnalysis>);
    expect(screen.getByText(/^No verdict:/).textContent).toContain(text);
    expect(screen.queryByText("Verdict")).toBeNull();
  });

  it("uses dashes and defaults for a sparse analysis", () => {
    show({ fallKind: null, probability: null, residentRisk: null, threshold: null, parsed: false, meetsThreshold: null });
    expect(stat("Type").textContent).toContain("Unknown");
    expect(stat("Probability").textContent).toContain("—");
    expect(stat("Resident risk").textContent).toContain("Not set");
    expect(stat("Site threshold").textContent).toContain("—");
  });
});

describe("FallSection: location and map", () => {
  it("shows both locations as links and the distance", () => {
    show();
    expect(screen.getByRole("link", { name: "38.620000, -121.250000" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "38.600000, -121.200000" })).toBeTruthy();
    expect(screen.getByText("Distance from base").nextElementSibling?.textContent).toBe("1.25 km");
  });

  it("explains a missing base location and a missing alert position, and then has no map", () => {
    show({ baseLocation: null, alertLocation: null, distanceFromBaseMeters: null });
    expect(screen.getByText(/no base location set/)).toBeTruthy();
    expect(screen.getByText(/carries no GPS position/)).toBeTruthy();
    expect(screen.queryByTestId("fall-map")).toBeNull();
  });

  it("plots this alert, the recent falls that have a position, and the base", () => {
    show({
      nests: [{ name: "Home", address: null, isActive: true, points: [loc, loc, loc] }],
      recentFalls: [
        { id: "f1", startedAt: "2026-11-01T00:00:00Z", title: null, fallKind: "hard", probability: 95, isFalsePositive: false, reason: null, acknowledgedAt: null, completedAt: null, location: loc },
        { id: "f2", startedAt: "2026-11-02T00:00:00Z", title: null, fallKind: null, probability: null, isFalsePositive: null, reason: null, acknowledgedAt: null, completedAt: null, location: null },
      ],
    });
    const pins = screen.getAllByTestId("pin").map((p) => p.getAttribute("data-title"));
    expect(pins).toEqual(["This alert", "Hard fall", "Base location"]);
    expect(screen.getByTestId("fall-map").getAttribute("data-nests")).toBe("1");
    expect(screen.getAllByTestId("pin")[0].getAttribute("data-lines")).toContain("Outcome: False positive");
  });

  it("includes a false positive's reason in its pin", () => {
    show({ recentFalls: [{ id: "f1", startedAt: "2026-11-01T00:00:00Z", title: null, fallKind: "soft", probability: 70, isFalsePositive: true, reason: " Sensor glitch ", acknowledgedAt: null, completedAt: null, location: loc }] });
    expect(screen.getAllByTestId("pin")[1].getAttribute("data-lines")).toContain("Reason: Sensor glitch");
  });
});

describe("FallSection: resolution", () => {
  it("shows the resolution time, acknowledgement and resolved-at times and the all-zero packet time", () => {
    show();
    expect(stat("Resolution time").textContent).toContain("41s");
    expect(stat("Acknowledged at").textContent).toContain("Nov 11, 1:24:40 PM");
    expect(stat("Resolved at").textContent).toContain("Nov 11, 1:25:10 PM");
    expect(stat("Time to all-zero packet").textContent).toContain("1m 58s");
    expect(stat("Time to all-zero packet").textContent).toContain("Alert start to the first all-zero alertBit packet");
  });

  it.each([
    ["NOT_FOUND", { seconds: null, resolvedAt: null }, "No all-zero packet found yet"],
    ["NO_FLAG", { seconds: null, resolvedAt: null }, "No flagged packet at the alert start"],
    ["UNAVAILABLE", { seconds: null, resolvedAt: null }, "Sensor data unavailable"],
  ] as const)("%s explains itself", (status, over, hint) => {
    show({ resolution: { ...base.resolution!, status, ...over } });
    expect(stat("Time to all-zero packet").textContent).toContain(hint);
    expect(stat("Time to all-zero packet").textContent).toContain("—");
  });

  it("flags a resolution over 3 hours", () => {
    show({ resolution: { ...base.resolution!, seconds: 4 * 3600, exceededLimit: true } });
    expect(stat("Time to all-zero packet").textContent).toContain("Took longer than 3 hours");
  });

  it("warns when the alert has no completed-at time", () => {
    show({ resolution: { ...base.resolution!, completedAt: null, completedSeconds: null } });
    expect(stat("Resolution time").textContent).toContain("The alert has no completed at time");
    expect(stat("Resolved at").textContent).toContain("—");
  });

  it("captions a slow acknowledgement (2-4 h) and a very slow one (over 4 h)", () => {
    const { unmount } = show({ acknowledgedSeconds: 3 * 3600 });
    expect(stat("Acknowledged at").textContent).toContain("2 to 4 hours");
    unmount();
    show({ acknowledgedSeconds: 5 * 3600 });
    expect(stat("Acknowledged at").textContent).toContain("over 4 hours");
  });

  it("has no resolution card when there is no resolution", () => {
    show({ resolution: undefined });
    expect(screen.queryByText("Resolution time")).toBeNull();
  });

  it("lists the notes", () => {
    show({ notes: ["Sensor data lookup failed"] });
    expect(screen.getByText("Sensor data lookup failed")).toBeTruthy();
  });
});

describe("FallSection: packets table", () => {
  it("labels BEFORE, ALERT and After rows and formats offsets, bits and positions", () => {
    show({ packets: [packet(-30, { category: "BEFORE", alertBit: "000000000" }), packet(0), packet(100, { category: "RESOLVED", alertBit: "000000000", latitude: null, longitude: null })] });
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    const cells = (r: HTMLElement) => within(r).getAllByRole("cell").map((c) => c.textContent);
    expect(cells(rows[0])[0]).toBe("BEFORE");
    expect(cells(rows[0])[2]).toBe("−30s");
    expect(cells(rows[1])[0]).toBe("ALERT");
    expect(cells(rows[1])[2]).toBe("0s");
    expect(cells(rows[2])[0]).toBe("After");
    expect(cells(rows[2])[2]).toBe("1m 40s");
    expect(cells(rows[2])[6]).toBe("—"); // no position
  });

  it("marks the packet nearest the acknowledgement, with its offset", () => {
    show({ packets: [packet(0, { acknowledgedDeltaSeconds: -10 }), packet(5, { acknowledgedDeltaSeconds: 0 }), packet(9, { acknowledgedDeltaSeconds: 7 })] });
    expect(screen.getByText("Acknowledged (packet 10s before)")).toBeTruthy();
    expect(screen.getByText("Acknowledged (packet 7s after)")).toBeTruthy();
    expect(document.querySelectorAll("[title^=\"The packet nearest\"]")).toHaveLength(3);
  });

  it("has no table or pager without packets", () => {
    show({ packets: [] });
    expect(screen.queryByRole("navigation", { name: "Packet pages" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Packet time" })).toBeNull();
  });

  it("pages 15 packets at a time", async () => {
    show({ packets: Array.from({ length: 31 }, (_, i) => packet(i)) });
    const nav = () => screen.getByRole("navigation", { name: "Packet pages" });
    expect(within(nav()).getByText("Showing 1–15 of 31 packets")).toBeTruthy();
    expect((within(nav()).getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(within(nav()).getByRole("button", { name: "Next" }));
    await userEvent.click(within(nav()).getByRole("button", { name: "Next" }));
    expect(within(nav()).getByText("Showing 31–31 of 31 packets")).toBeTruthy();
    expect((within(nav()).getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("FallSection: falls in the last 30 days", () => {
  it("says so when there are none", () => {
    show({ recentFalls: [] });
    expect(screen.getByText(/No other falls for this resident/)).toBeTruthy();
    expect(screen.getByText("Total: 0")).toBeTruthy();
  });

  it("lists type, probability, outcome, reason (false positives only), times and an Open link", () => {
    show({
      recentFalls: [
        { id: "f1", startedAt: "2026-11-01T20:00:00Z", period: "day", title: null, fallKind: "hard", probability: 95, isFalsePositive: true, reason: " Sat down hard ", acknowledgedAt: "2026-11-01T20:01:00Z", completedAt: "2026-11-01T20:05:00Z", location: loc },
        { id: "f2", startedAt: "2026-11-02T20:00:00Z", title: null, fallKind: null, probability: null, isFalsePositive: false, reason: "ignored", acknowledgedAt: null, completedAt: null, location: null },
        { id: "f3", startedAt: "2026-11-03T20:00:00Z", title: null, fallKind: "soft", probability: 80, isFalsePositive: null, reason: null, acknowledgedAt: null, completedAt: null, location: loc },
      ],
    });
    expect(screen.getByText("Total: 3")).toBeTruthy();
    const table = screen.getByRole("heading", { name: "Falls in the last 30 days" }).closest("section")!;
    const rows = within(table).getAllByRole("row").slice(1);
    const cells = (r: HTMLElement) => within(r).getAllByRole("cell").map((c) => c.textContent);
    expect(cells(rows[0]).slice(0, 8)).toEqual(["Nov 1, 12:00 PM", "Day", "Hard", "95%", "False positive", "Sat down hard", "1m 0s", "Nov 1, 12:05 PM"]);
    expect(cells(rows[1]).slice(0, 8)).toEqual(["Nov 2, 12:00 PM", "—", "Unknown", "—", "True fall", "—", "—", "—"]);
    expect(cells(rows[2])[4]).toBe("Not acknowledged");
    expect(within(rows[0]).getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/alert/?id=f1");
    expect(screen.getByText(/Falls without a GPS position are listed but not plotted/)).toBeTruthy();
  });

  it("omits the not-plotted note when every fall has a position", () => {
    show({ recentFalls: [{ id: "f1", startedAt: "2026-11-01T20:00:00Z", title: null, fallKind: "soft", probability: 80, isFalsePositive: null, reason: null, acknowledgedAt: null, completedAt: null, location: loc }] });
    expect(screen.queryByText(/not plotted/)).toBeNull();
  });
});

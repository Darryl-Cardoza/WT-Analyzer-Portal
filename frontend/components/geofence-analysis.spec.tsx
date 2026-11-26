// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GeofenceAnalysis, GpsFix } from "@/lib/alerts";

// The real map needs Google; the stub reports what it was given.
vi.mock("@/components/path-map", () => ({
  PathMap: ({ markers, estimated, nests }: { markers: { role: string; title: string; lines: string[] }[]; estimated: boolean; nests?: unknown[] }) => (
    <div data-testid="path-map" data-estimated={String(estimated)} data-nests={nests?.length ?? 0}>
      {markers.map((m, i) => (
        <span key={i} data-testid="marker" data-role={m.role} data-title={m.title} data-lines={m.lines.join("|")} />
      ))}
    </div>
  ),
}));

import { GeofenceSection } from "./geofence-analysis";

const TZ = "America/Los_Angeles";
const fix = (category: GpsFix["category"], over: Partial<GpsFix> = {}): GpsFix => ({
  category,
  gpsTimestamp: "2026-11-11T21:24:25Z",
  packetTimestamp: "2026-11-11T21:24:29Z",
  latitude: 38.62,
  longitude: -121.25,
  hdop: 1.1,
  satellites: 8,
  fixQuality: 1,
  alertBit: "000100000",
  gpsAgeMinutes: 0.5,
  packetCount: 2,
  segmentDistanceMeters: 11.2,
  cumulativeDistanceMeters: 22.4,
  sensorDocumentId: "doc1",
  deviceId: "79058839",
  ...over,
});
const base: GeofenceAnalysis = {
  type: "GEOFENCE",
  deviceId: "79058839",
  window: { start: "2026-11-11T21:24:29Z", end: "2026-11-11T21:25:10Z", valid: true },
  alertSource: {
    source: "BLE",
    confidence: "High: one candidate",
    reason: "Packet type WT-BLE",
    candidateCount: 1,
    trigger: { rawPayloadType: "WT-BLE", packetTimestamp: "2026-11-11T21:24:29Z", offsetSeconds: 6, alertBit: "000100000", sensorDocumentId: "doc1" },
  },
  alertHdop: 2.5,
  freshGpsFixes: 2,
  fixesWithCoordinates: 2,
  fixesWithHdop: 2,
  averageHdop: 1.1,
  hdopAboveThreshold: false,
  distanceTravelledMeters: 79,
  gpsCoverage: "2 of 2 fixes",
  alertLocation: { lat: 38.62, lon: -121.25 },
  baseLocation: { lat: 38.6, lon: -121.2 },
  distanceFromBaseMeters: 1250,
  beyondDistanceThreshold: true,
  gpsFixes: [fix("BEFORE"), fix("DURING"), fix("AFTER")],
  nests: [],
  sensorDocumentIds: ["doc1", "doc2"],
  isFalsePositive: null,
  notes: [],
};
const show = (over: Partial<GeofenceAnalysis> = {}) => render(<GeofenceSection analysis={{ ...base, ...over }} timeZone={TZ} month="November 2026" />);
const stat = (label: string) => screen.getByText(label).parentElement!;

describe("GeofenceSection: movement analysis", () => {
  it("shows the source with its confidence, fresh fixes, HDOP and distance travelled", () => {
    show();
    expect(stat("Alert source").textContent).toContain("BLE");
    expect(stat("Alert source").textContent).toContain("High: one candidate");
    expect(stat("Fresh GPS fixes").textContent).toContain("2 with usable coordinates");
    expect(stat("HDOP at alert").textContent).toContain("2.5");
    expect(stat("HDOP at alert").textContent).toContain("Medium signal");
    expect(stat("Distance travelled").textContent).toContain("79 m");
    expect(stat("Distance travelled").textContent).toContain("2 of 2 fixes");
  });

  it("explains an Unknown source with its reason instead of a confidence", () => {
    show({ alertSource: { ...base.alertSource, source: "Unknown", reason: "No packets found", trigger: null } });
    expect(stat("Alert source").textContent).toContain("Unknown");
    expect(stat("Alert source").textContent).toContain("No packets found");
    expect(screen.queryByText("Triggering packet")).toBeNull();
  });

  it("says when there were no fresh fixes", () => {
    show({ freshGpsFixes: 0, fixesWithCoordinates: 0 });
    expect(stat("Fresh GPS fixes").textContent).toContain("None during the alert");
  });

  it.each([
    [true, "1 reading, above the site limit (less precise)", 1],
    [false, "1 reading, within the site limit", 1],
    [null, "1 reading", 1],
  ])("average HDOP above-limit=%s", (hdopAboveThreshold, hint, fixesWithHdop) => {
    show({ hdopAboveThreshold, fixesWithHdop });
    expect(screen.getByText("Average HDOP").nextElementSibling?.textContent).toContain(hint);
  });

  it("says 'No HDOP readings' without an average, even with no triggering packet", () => {
    show({ averageHdop: null, fixesWithHdop: 0, hdopAboveThreshold: null, alertSource: { ...base.alertSource, trigger: null } });
    expect(screen.getByText("Average HDOP").nextElementSibling?.textContent).toBe("No HDOP readings");
  });

  it.each([
    [0.1, "Strong signal", "text-ok-ink"],
    [2, "Strong signal", "text-ok-ink"],
    [2.1, "Medium signal", "text-yellow-900"],
    [4.5, "Medium signal", "text-yellow-900"],
    [4.6, "Weak signal", "text-red-900"],
    [0, "Weak signal", "text-red-900"],
    [null, "No reading", "text-ink"],
  ])("HDOP at alert %s is %s", (alertHdop, label, tone) => {
    show({ alertHdop });
    expect(stat("HDOP at alert").textContent).toContain(label);
    expect(stat("HDOP at alert").className).toContain(tone);
  });

  it("describes the triggering packet", () => {
    show();
    expect(screen.getByText("Triggering packet").nextElementSibling?.textContent).toBe("Nov 11, 1:24:29 PM · 6.0 s after the alert started");
    expect(screen.getByText("Packet type").nextElementSibling?.textContent).toBe("WT-BLE");
    expect(screen.getByText("Why this source").nextElementSibling?.textContent).toBe("Packet type WT-BLE");
  });

  it("shows dashes for a trigger without a packet type or HDOP", () => {
    show({ alertHdop: null, alertSource: { ...base.alertSource, trigger: { ...base.alertSource.trigger!, rawPayloadType: "" } } });
    expect(screen.getByText("Packet type").nextElementSibling?.textContent).toBe("—");
    expect(stat("HDOP at alert").textContent).toContain("—");
  });
});

describe("GeofenceSection: location", () => {
  it.each([
    [true, "Beyond the site distance threshold"],
    [false, "Within the site distance threshold"],
  ])("beyondDistanceThreshold=%s", (beyondDistanceThreshold, hint) => {
    show({ beyondDistanceThreshold });
    expect(stat("Distance from base").textContent).toContain("1.25 km");
    expect(stat("Distance from base").textContent).toContain(hint);
  });

  it("has no threshold hint when there is no threshold, and dashes for missing locations", () => {
    show({ beyondDistanceThreshold: null, distanceFromBaseMeters: null, alertLocation: null, baseLocation: null });
    expect(stat("Distance from base").textContent).toBe("Distance from base—");
    expect(screen.getByText("Alert location").nextElementSibling?.textContent).toBe("—");
    expect(screen.getByText("Base location").nextElementSibling?.textContent).toBe("—");
  });
});

describe("GeofenceSection: path map", () => {
  it("gives the map one marker per fix with its role, plus the base", () => {
    show({ nests: [{ name: "Home", address: null, isActive: true, points: [] }] });
    const markers = screen.getAllByTestId("marker");
    expect(markers.map((m) => [m.getAttribute("data-role"), m.getAttribute("data-title")])).toEqual([
      ["start", "Last fix before the alert"],
      ["mid", "Fix during the alert"],
      ["end", "First fix after the alert"],
      ["base", "Base location"],
    ]);
    expect(markers[0].getAttribute("data-lines")).toBe("Lat, Long: 38.620000, -121.250000|HDOP: 1.1|Fix quality: 1|Satellites: 8|Location timestamp: Nov 11, 1:24:25 PM");
    expect(screen.getByTestId("path-map").getAttribute("data-estimated")).toBe("false");
    expect(screen.getByTestId("path-map").getAttribute("data-nests")).toBe("1");
  });

  it("marks the line as estimated when nothing was recorded during the alert, and uses dashes for missing readings", () => {
    show({ baseLocation: null, gpsFixes: [fix("BEFORE", { hdop: null, satellites: null, fixQuality: null, gpsTimestamp: null }), fix("AFTER")] });
    expect(screen.getByTestId("path-map").getAttribute("data-estimated")).toBe("true");
    expect(screen.getAllByTestId("marker")).toHaveLength(2); // no base
    expect(screen.getAllByTestId("marker")[0].getAttribute("data-lines")).toContain("HDOP: —|Fix quality: —|Satellites: —|Location timestamp: —");
  });

  it("says there is nothing to plot, and still shows the notes", () => {
    show({ gpsFixes: [], notes: ["Sensor data lookup failed"] });
    expect(screen.queryByTestId("path-map")).toBeNull();
    expect(screen.getByText("No GPS fixes to plot for this alert.")).toBeTruthy();
    expect(screen.getByText("Sensor data lookup failed")).toBeTruthy();
  });

  it("skips fixes without usable coordinates", () => {
    show({ gpsFixes: [fix("DURING", { latitude: NaN }), fix("DURING")] });
    expect(screen.getAllByTestId("marker").filter((m) => m.getAttribute("data-role") === "mid")).toHaveLength(1);
  });
});

describe("GeofenceSection: GPS fixes table", () => {
  it("shows a row per fix with category, formatted times, readings and distances", () => {
    show();
    const table = screen.getByRole("heading", { name: "GPS fixes" }).closest("section")!;
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    const cells = within(rows[1]).getAllByRole("cell").map((c) => c.textContent);
    expect(cells).toEqual(["DURING", "Nov 11, 1:24:29 PM", "38.620000, -121.250000", "1.1", "8", "1", "000100000", "79058839", "30s", "2", "11 m", "22 m"]);
  });

  it("shows dashes for missing readings, packet counts and distances", () => {
    show({ gpsFixes: [fix("BEFORE", { hdop: null, satellites: null, fixQuality: null, alertBit: null, deviceId: null, gpsAgeMinutes: null, packetCount: null, segmentDistanceMeters: null, cumulativeDistanceMeters: null })] });
    const table = screen.getByRole("heading", { name: "GPS fixes" }).closest("section")!;
    const cells = within(within(table).getAllByRole("row")[1]).getAllByRole("cell").map((c) => c.textContent);
    expect(cells).toEqual(["BEFORE", "Nov 11, 1:24:29 PM", "38.620000, -121.250000", "—", "—", "—", "—", "—", "—", "—", "—", "—"]);
  });

  it("says so when there are no fixes", () => {
    show({ gpsFixes: [] });
    expect(screen.getByText("No GPS fixes were found around this alert.")).toBeTruthy();
  });
});

describe("GeofenceSection: sensor documents", () => {
  it("lists the document ids with a count", () => {
    show();
    expect(screen.getByText("Sensor document IDs (2)")).toBeTruthy();
    expect(screen.getByText("doc2")).toBeTruthy();
  });
  it("hides the list when there are none", () => {
    show({ sensorDocumentIds: [] });
    expect(screen.queryByText(/Sensor document IDs/)).toBeNull();
  });
});

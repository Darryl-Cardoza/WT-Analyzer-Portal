import { describe, expect, it } from "vitest";
import {
  alertsHref,
  toggleType,
  toggleValue,
  applyFilters,
  searchRange,
  backHref,
  detailHref,
  falsePositiveOptions,
  humanize,
  one,
  paginate,
  sourceOptions,
  statusOptions,
  typeLabel,
  validFp,
  validSource,
  validType,
} from "./alerts";
import { param } from "./alerts";
import type { AlertSummary } from "./alerts";
import { formatAge, formatDateTime, formatDay, formatDuration, formatMeters, formatOffset, todayIn } from "./format";

const alert = (over: Partial<AlertSummary>): AlertSummary => ({
  id: "1",
  alertType: "GEOFENCE",
  alertStatus: "RESOLVED",
  alertTitle: "t",
  resident: "r@x.org",
  residentName: null,
  startedAt: "2026-11-11T21:24:29.970Z",
  endedAt: null,
  isFalsePositive: null,
  source: null,
  ...over,
});

describe("labels", () => {
  it("maps alert types to the names AdminOps uses", () => {
    expect(typeLabel("GEOFENCE")).toBe("Nest");
    expect(typeLabel("AI_FALL_DETECTION")).toBe("Fall");
    expect(typeLabel("DOOR_CHANGE")).toBe("Door");
  });
  it("shows an unknown type readably instead of hiding it", () => {
    expect(typeLabel("SOS_BUTTON")).toBe("Sos Button");
    expect(typeLabel("")).toBe("Unknown");
  });
  it("humanizes statuses", () => {
    expect(humanize("AUTO_ACKNOWLEDGED")).toBe("Auto Acknowledged");
    expect(humanize(undefined)).toBe("");
  });
});

describe("URL helpers", () => {
  it("one() takes the first non-blank string from a query value", () => {
    expect(one(" a@b.c ")).toBe("a@b.c");
    expect(one(["x", "y"])).toBe("x");
    expect(one("  ")).toBeUndefined();
    expect(one(undefined)).toBeUndefined();
  });
  it("validType() accepts only known types", () => {
    expect(validType("GEOFENCE")).toBe("GEOFENCE");
    expect(validType("geofence")).toBeUndefined();
    expect(validType("<script>")).toBeUndefined();
  });
  it("alertsHref() leaves out blank filters and encodes the rest", () => {
    expect(alertsHref({})).toBe("/alerts/");
    expect(alertsHref({ email: "", date: "2026-11-11" })).toBe("/alerts/?date=2026-11-11");
    expect(alertsHref({ email: "a+b@x.org", type: "GEOFENCE" })).toBe("/alerts/?email=a%2Bb%40x.org&type=GEOFENCE");
  });
});

describe("detail page links", () => {
  it("detailHref remembers the search the alert was opened from", () => {
    expect(detailHref("abc", {})).toBe("/alert/?id=abc");
    const href = detailHref("abc", { email: "a@x.org", date: "2026-11-11", type: "GEOFENCE" });
    // the email is encoded once inside the query (%40) and again as part of `from` (%2540)
    expect(href).toBe("/alert/?id=abc&from=email%3Da%2540x.org%26date%3D2026-11-11%26type%3DGEOFENCE");
  });

  it("backHref rebuilds that search, round-tripping detailHref", () => {
    const filters = { email: "a+b@x.org", date: "2026-11-11", time: "13:24", type: "DOOR_CHANGE", status: "RESOLVED" };
    const from = new URL(detailHref("abc", filters), "http://x").searchParams.get("from") ?? undefined;
    expect(backHref(from)).toBe(alertsHref(filters));
  });

  it("backHref only ever returns a fixed /alerts path, whatever `from` holds", () => {
    expect(backHref(undefined)).toBe("/alerts/");
    expect(backHref("")).toBe("/alerts/");
    expect(backHref("next=https://evil.example&redirect=//evil.example")).toBe("/alerts/");
    expect(backHref("type=<script>&date=2026-11-11")).toBe("/alerts/?date=2026-11-11");
    expect(backHref("https://evil.example/alerts?date=2026-11-11")).toBe("/alerts/");
  });
});

describe("filtering", () => {
  const list = [
    alert({ id: "1", alertType: "GEOFENCE", alertStatus: "RESOLVED" }),
    alert({ id: "2", alertType: "DOOR_CHANGE", alertStatus: "AUTO_ACKNOWLEDGED" }),
    alert({ id: "3", alertType: "DOOR_CHANGE", alertStatus: "RESOLVED" }),
  ];
  it("filters by type, status, both, or neither", () => {
    expect(applyFilters(list, {}).map((a) => a.id)).toEqual(["1", "2", "3"]);
    expect(applyFilters(list, { type: "DOOR_CHANGE" }).map((a) => a.id)).toEqual(["2", "3"]);
    expect(applyFilters(list, { status: "RESOLVED" }).map((a) => a.id)).toEqual(["1", "3"]);
    expect(applyFilters(list, { type: "DOOR_CHANGE", status: "RESOLVED" }).map((a) => a.id)).toEqual(["3"]);
    expect(applyFilters(list, { type: "GEOFENCE", status: "AUTO_ACKNOWLEDGED" })).toEqual([]);
  });
  it("lists each status present once, sorted", () => {
    // Known statuses are always listed (the view dims the absent ones); any other status present is added.
    expect(statusOptions(list)).toEqual(["AUTO_ACKNOWLEDGED", "RESOLVED", "UNATTENDED"]);
    expect(statusOptions([alert({ alertStatus: "OTHER" })])).toEqual(["AUTO_ACKNOWLEDGED", "OTHER", "RESOLVED", "UNATTENDED"]);
  });
});

describe("date formatting", () => {
  it("todayIn uses the site's calendar day, not the server's", () => {
    // 05:30 UTC on Nov 13 is still the evening of Nov 12 in Los Angeles (UTC-8)
    const now = new Date("2026-11-13T05:30:00Z");
    expect(todayIn("America/Los_Angeles", now)).toBe("2026-11-12");
    expect(todayIn("UTC", now)).toBe("2026-11-13");
  });
  it("formats a UTC instant in the site's zone", () => {
    expect(formatDateTime("2026-11-11T21:24:29.970Z", "America/Los_Angeles")).toBe("Nov 11, 1:24 PM");
    expect(formatDateTime("2026-11-11T21:24:29.970Z", "UTC")).toBe("Nov 11, 9:24 PM UTC"); // UTC is always labelled
  });
  it("shows a dash for missing or invalid values", () => {
    expect(formatDateTime(null, "UTC")).toBe("—");
    expect(formatDateTime("garbage", "UTC")).toBe("—");
  });
  it("formats a calendar day without shifting it", () => {
    expect(formatDay("2026-11-12")).toBe("Nov 12, 2026");
  });
  it("formats durations", () => {
    const t = "2026-11-12T14:44:47.544Z";
    expect(formatDuration(t, "2026-11-12T14:45:28.544Z")).toBe("41s");
    expect(formatDuration(t, "2026-11-12T14:46:50.843Z")).toBe("2m 3s");
    expect(formatDuration(t, "2026-11-12T15:50:47.544Z")).toBe("1h 6m");
    expect(formatDuration(t, t)).toBe("0s");
  });
  it("has no duration when a time is missing or backwards", () => {
    expect(formatDuration(null, "2026-11-12T14:44:47Z")).toBeNull();
    expect(formatDuration("2026-11-12T14:44:47Z", null)).toBeNull();
    expect(formatDuration("2026-11-12T14:44:47Z", "2026-11-12T14:00:00Z")).toBeNull();
    expect(formatDuration("junk", "2026-11-12T14:00:00Z")).toBeNull();
  });
  it("shows seconds on GPS fix times only when asked", () => {
    expect(formatDateTime("2026-11-11T21:24:29.970Z", "America/Los_Angeles", true)).toBe("Nov 11, 1:24:29 PM");
    expect(formatDateTime("2026-11-11T21:24:29.970Z", "America/Los_Angeles")).toBe("Nov 11, 1:24 PM");
  });
  it("formats the age of a GPS fix", () => {
    expect(formatAge(0.02)).toBe("1s");
    expect(formatAge(0)).toBe("0s");
    expect(formatAge(1.5)).toBe("1m 30s");
    expect(formatAge(75)).toBe("1h 15m");
    expect(formatAge(null)).toBe("—");
    expect(formatAge(-1)).toBe("—"); // a fix newer than its packet makes no sense: show nothing
  });
  it("describes a packet's time relative to the alert start", () => {
    expect(formatOffset(6)).toBe("6.0 s after the alert started");
    expect(formatOffset(-2.5)).toBe("2.5 s before the alert started");
    expect(formatOffset(0)).toBe("at the alert start");
    expect(formatOffset(null)).toBe("—");
  });
  it("formats distances in metres or kilometres", () => {
    expect(formatMeters(78.89)).toBe("79 m");
    expect(formatMeters(0)).toBe("0 m");
    expect(formatMeters(1250)).toBe("1.25 km");
    expect(formatMeters(null)).toBe("—");
  });
});

describe("source and false positive filters", () => {
  const list = [
    alert({ id: "1", source: "LTE", isFalsePositive: true }),
    alert({ id: "2", source: "BLE", isFalsePositive: false }),
    alert({ id: "3", source: "Unknown", isFalsePositive: null }),
    alert({ id: "4", alertType: "DOOR_CHANGE", source: null, isFalsePositive: true }),
  ];

  it("filters by source; alert types without a source drop out", () => {
    expect(applyFilters(list, { source: "LTE" }).map((a) => a.id)).toEqual(["1"]);
    expect(applyFilters(list, { source: "BLE" }).map((a) => a.id)).toEqual(["2"]);
    expect(applyFilters(list, { source: "Unknown" }).map((a) => a.id)).toEqual(["3"]);
  });

  it("filters by false positive: yes, no and not classified (null)", () => {
    expect(applyFilters(list, { fp: "yes" }).map((a) => a.id)).toEqual(["1", "4"]);
    expect(applyFilters(list, { fp: "no" }).map((a) => a.id)).toEqual(["2"]);
    expect(applyFilters(list, { fp: "none" }).map((a) => a.id)).toEqual(["3"]);
  });

  it("combines with type and status", () => {
    expect(applyFilters(list, { type: "GEOFENCE", source: "LTE", fp: "yes" }).map((a) => a.id)).toEqual(["1"]);
    expect(applyFilters(list, { type: "DOOR_CHANGE", source: "LTE" })).toEqual([]);
  });

  it("lists every false-positive outcome in a fixed order and flags the absent ones", () => {
    expect(sourceOptions(list)).toEqual(["BLE", "LTE", "Unknown"]);
    expect(sourceOptions([alert({ alertType: "DOOR_CHANGE", source: null })])).toEqual([]); // no Nest alerts: no Source row
    expect(falsePositiveOptions(list).map((f) => f.key)).toEqual(["yes", "no", "none"]);
    expect(falsePositiveOptions([alert({ isFalsePositive: false })]).filter((f) => f.present).map((f) => f.key)).toEqual(["no"]);
  });

  it("accepts only known values from the URL", () => {
    expect(validSource("LTE")).toBe("LTE");
    expect(validSource("5G")).toBeUndefined();
    expect(validFp("yes")).toBe("yes");
    expect(validFp("true")).toBeUndefined();
  });

  it("keeps the filters in the back link and drops unknown values", () => {
    expect(backHref("date=2026-11-11&source=LTE&fp=no")).toBe("/alerts/?date=2026-11-11&source=LTE&fp=no");
    expect(backHref("date=2026-11-11&source=evil&fp=maybe")).toBe("/alerts/?date=2026-11-11");
  });
});

describe("pagination", () => {
  const items = Array.from({ length: 31 }, (_, i) => i);
  it("paginate slices 30 per page and clamps the page", () => {
    expect(paginate(items, undefined)).toMatchObject({ page: 1, totalPages: 2, start: 0 });
    expect(paginate(items, undefined).items).toHaveLength(30);
    expect(paginate(items, "2").items).toEqual([30]);
    expect(paginate(items, "99").page).toBe(2);
    expect(paginate(items, "abc").page).toBe(1);
    expect(paginate([], "3")).toMatchObject({ items: [], page: 1, totalPages: 1 });
  });
  it("page round-trips through detailHref/backHref and junk is dropped", () => {
    const from = new URL(detailHref("abc", { date: "2026-11-11", page: "3" }), "http://x").searchParams.get("from") ?? undefined;
    expect(backHref(from)).toBe("/alerts/?date=2026-11-11&page=3");
    expect(backHref("date=2026-11-11&page=evil")).toBe("/alerts/?date=2026-11-11");
  });
});

describe("searchRange", () => {
  it("is undefined without a To date", () => {
    expect(searchRange({ date: "2026-11-10", time: "09:00", toTime: "10:00" })).toBeUndefined();
  });
  it("defaults to midnight and the end of the To date", () => {
    expect(searchRange({ date: "2026-11-10", toDate: "2026-11-12" })).toEqual({ from: "2026-11-10T00:00", to: "2026-11-13T00:00" });
  });
  it("uses the given times and rolls over month ends", () => {
    expect(searchRange({ date: "2026-11-10", time: "08:30", toDate: "2026-11-30" })?.to).toBe("2026-12-01T00:00");
    expect(searchRange({ date: "2026-11-10", time: "08:30", toDate: "2026-11-12", toTime: "17:45" })).toEqual({
      from: "2026-11-10T08:30",
      to: "2026-11-12T17:45",
    });
  });
});

describe("param", () => {
  it("reads a trimmed value from the URL, or undefined when it is missing or blank", () => {
    const sp = new URLSearchParams("a=%20x%20&b=&c=%20%20");
    expect(param(sp, "a")).toBe("x");
    expect(param(sp, "b")).toBeUndefined();
    expect(param(sp, "c")).toBeUndefined();
    expect(param(sp, "missing")).toBeUndefined();
  });
  it("takes the first when a name is repeated", () => {
    expect(param(new URLSearchParams("a=1&a=2"), "a")).toBe("1");
  });
  it("detailHref puts the id in the query, encoded, so any id is safe", () => {
    expect(detailHref("a/b c?d", {})).toBe("/alert/?id=a%2Fb%20c%3Fd");
  });
});

describe("selecting several alert types", () => {
  const mk = (alertType: string) => ({ alertType, alertStatus: "X", isFalsePositive: null, source: null }) as never;
  it("toggleType adds and removes types, in chip order, and clears to undefined", () => {
    expect(toggleType(undefined, "AI_FALL_DETECTION")).toBe("AI_FALL_DETECTION");
    expect(toggleType("AI_FALL_DETECTION", "DOOR_CHANGE")).toBe("DOOR_CHANGE,AI_FALL_DETECTION");
    expect(toggleType("DOOR_CHANGE,AI_FALL_DETECTION", "DOOR_CHANGE")).toBe("AI_FALL_DETECTION");
    expect(toggleType("DOOR_CHANGE", "DOOR_CHANGE")).toBeUndefined();
  });
  it("validType drops unknown values and applyFilters keeps every selected type", () => {
    expect(validType("BOGUS,GEOFENCE")).toBe("GEOFENCE");
    expect(validType("BOGUS")).toBeUndefined();
    const list = [mk("DOOR_CHANGE"), mk("GEOFENCE"), mk("AI_FALL_DETECTION")];
    expect(applyFilters(list, { type: "DOOR_CHANGE,AI_FALL_DETECTION" }).map((a) => a.alertType)).toEqual(["DOOR_CHANGE", "AI_FALL_DETECTION"]);
  });
});

describe("selecting several statuses, sources and false-positive outcomes", () => {
  const mk = (alertStatus: string, source: string | null, isFalsePositive: boolean | null) => ({ alertType: "GEOFENCE", alertStatus, source, isFalsePositive }) as never;
  const list = [mk("RESOLVED", "BLE", true), mk("AUTO_ACKNOWLEDGED", "LTE", false), mk("UNATTENDED", null, null)];
  it("toggleValue adds and removes, and clears to undefined", () => {
    expect(toggleValue(undefined, "BLE")).toBe("BLE");
    expect(toggleValue("BLE", "LTE")).toBe("BLE,LTE");
    expect(toggleValue("BLE,LTE", "BLE")).toBe("LTE");
    expect(toggleValue("LTE", "LTE")).toBeUndefined();
  });
  it("validSource / validFp keep only known values", () => {
    expect(validSource("LTE,BOGUS,BLE")).toBe("BLE,LTE");
    expect(validFp("no,BOGUS,yes")).toBe("yes,no");
    expect(validFp("BOGUS")).toBeUndefined();
  });
  it("applyFilters matches any selected value within a filter", () => {
    const f = (o: object) => applyFilters(list, o).map((a) => a.alertStatus);
    expect(f({ status: "RESOLVED,UNATTENDED" })).toEqual(["RESOLVED", "UNATTENDED"]);
    expect(f({ source: "BLE,LTE" })).toEqual(["RESOLVED", "AUTO_ACKNOWLEDGED"]);
    expect(f({ fp: "yes,none" })).toEqual(["RESOLVED", "UNATTENDED"]);
    expect(f({ status: "RESOLVED,UNATTENDED", fp: "none" })).toEqual(["UNATTENDED"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  formatAge,
  formatDateTime,
  formatDay,
  formatDuration,
  formatMeters,
  formatOffset,
  formatSeconds,
  todayIn,
} from "./format";

const ISO = "2026-11-11T21:24:29.970Z"; // 1:24 PM in Los Angeles (PST)
const LA = "America/Los_Angeles";

describe("todayIn", () => {
  it("is the calendar date in that zone, which can differ from UTC's", () => {
    const now = new Date("2026-11-11T23:00:00Z");
    expect(todayIn("UTC", now)).toBe("2026-11-11");
    expect(todayIn(LA, now)).toBe("2026-11-11");
    expect(todayIn("Pacific/Auckland", now)).toBe("2026-11-12"); // already tomorrow there
  });
  it("defaults to the current time", () => {
    expect(todayIn("UTC")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatDateTime", () => {
  it("shows month, day and time in the given zone", () => {
    expect(formatDateTime(ISO, LA)).toBe("Nov 11, 1:24 PM");
  });
  it("adds seconds on request", () => {
    expect(formatDateTime(ISO, LA, true)).toBe("Nov 11, 1:24:29 PM");
  });
  it("accepts a Date", () => {
    expect(formatDateTime(new Date(ISO), LA)).toBe("Nov 11, 1:24 PM");
  });
  it("labels UTC times so they are not mistaken for site time", () => {
    expect(formatDateTime(ISO, "UTC")).toBe("Nov 11, 9:24 PM UTC");
  });
  it("never contains a narrow no-break space", () => {
    expect(formatDateTime(ISO, LA)).not.toMatch(/[  ]/);
  });
  it.each([null, undefined, "", "not a date"])("shows a dash for %j", (v) => {
    expect(formatDateTime(v, LA)).toBe("—");
  });
});

describe("formatSeconds", () => {
  it.each([
    [0, "0s"],
    [41, "41s"],
    [59, "59s"],
    [60, "1m 0s"],
    [123, "2m 3s"],
    [3599, "59m 59s"],
    [3600, "1h 0m"],
    [3900, "1h 5m"],
    [40.6, "41s"], // rounds
  ])("%s -> %s", (input, expected) => expect(formatSeconds(input)).toBe(expected));
});

describe("formatAge", () => {
  it("converts minutes to a duration", () => {
    expect(formatAge(0.02)).toBe("1s");
    expect(formatAge(1.5)).toBe("1m 30s");
    expect(formatAge(0)).toBe("0s");
  });
  it.each([null, undefined, NaN, Infinity, -1])("shows a dash for %j", (v) => expect(formatAge(v)).toBe("—"));
});

describe("formatOffset", () => {
  it("says after / before / at the alert start", () => {
    expect(formatOffset(6)).toBe("6.0 s after the alert started");
    expect(formatOffset(-2.54)).toBe("2.5 s before the alert started");
    expect(formatOffset(0)).toBe("at the alert start");
  });
  it.each([null, undefined, NaN, Infinity])("shows a dash for %j", (v) => expect(formatOffset(v)).toBe("—"));
});

describe("formatDuration", () => {
  it("is the time between start and end", () => {
    expect(formatDuration("2026-11-11T21:24:29Z", "2026-11-11T21:25:10Z")).toBe("41s");
    expect(formatDuration("2026-11-11T21:00:00Z", "2026-11-11T22:05:00Z")).toBe("1h 5m");
    expect(formatDuration(ISO, ISO)).toBe("0s");
  });
  it("is null when a time is missing, invalid, or the end is before the start", () => {
    expect(formatDuration(null, ISO)).toBeNull();
    expect(formatDuration(ISO, undefined)).toBeNull();
    expect(formatDuration("junk", ISO)).toBeNull();
    expect(formatDuration("2026-11-11T22:00:00Z", "2026-11-11T21:00:00Z")).toBeNull();
  });
});

describe("formatMeters", () => {
  it("uses metres under a kilometre and km above", () => {
    expect(formatMeters(0)).toBe("0 m");
    expect(formatMeters(79.4)).toBe("79 m");
    expect(formatMeters(1000)).toBe("1.00 km");
    expect(formatMeters(1250)).toBe("1.25 km");
  });
  it.each([null, undefined, NaN, Infinity])("shows a dash for %j", (v) => expect(formatMeters(v)).toBe("—"));
});

describe("formatDay", () => {
  it("formats a calendar date without shifting it by a time zone", () => {
    expect(formatDay("2026-11-12")).toBe("Nov 12, 2026");
    expect(formatDay("2026-01-01")).toBe("Jan 1, 2026");
  });
});

import { describe, expect, it } from "vitest";
import type { SiteSettings } from "./api";
import { diffForm, toForm } from "./site-settings";

const none = { softFallProbability: null, hardFallProbability: null };
const settings: SiteSettings["settings"] = {
  timeDifferenceThreshold: 3,
  batteryThreshold: 8,
  firstPacketDetection: false,
  deviceSwitching: 18,
  acknowledgeWaitTime: null,
  distanceThreshold: 500,
  hdopThreshold: 1.25,
  hdopUpperThreshold: null,
  timeZone: "America/Los_Angeles",
  nightWindow: { startTime: "21:00", endTime: "06:00", isDefault: false },
  showBatteryAlert: true,
  fallProfiles: { high: { softFallProbability: 75, hardFallProbability: 90 }, medium: none, low: none },
};

describe("diffForm", () => {
  it("sends nothing when nothing changed", () => {
    expect(diffForm(toForm(settings), settings)).toEqual({ changes: {}, errors: {} });
  });

  it("sends only what changed, as numbers, flags and nested fall values", () => {
    const form = { ...toForm(settings), distanceThreshold: "600", batteryThreshold: "10", "high.soft": "80", "low.hard": "95", timeZone: " America/Chicago " };
    expect(diffForm(form, settings).changes).toEqual({
      distanceThreshold: 600,
      batteryThreshold: 10,
      timeZone: "America/Chicago",
      fallProfiles: { high: { softFallProbability: 80 }, low: { hardFallProbability: 95 } },
    });
  });

  it("sends the whole night window when either end changes", () => {
    expect(diffForm({ ...toForm(settings), nightEnd: "05:30" }, settings).changes).toEqual({ nightWindow: { startTime: "21:00", endTime: "05:30" } });
  });

  it("fills in a setting that was never set, and skips one left empty", () => {
    expect(diffForm({ ...toForm(settings), acknowledgeWaitTime: "18000" }, settings).changes).toEqual({ acknowledgeWaitTime: 18000 });
    expect(diffForm(toForm(settings), settings).changes).not.toHaveProperty("hdopUpperThreshold");
  });

  it("reports a field that is not a number, or that had a value and was emptied", () => {
    const { changes, errors } = diffForm({ ...toForm(settings), batteryThreshold: "abc", distanceThreshold: "", timeZone: "", nightStart: "" }, settings);
    expect(errors).toEqual({ batteryThreshold: "Must be a number", distanceThreshold: "Enter a value", timeZone: "Enter a time zone", nightStart: "Enter both a start and an end time" });
    expect(changes).toEqual({});
  });

  it("treats 0 as a real value", () => {
    expect(diffForm({ ...toForm(settings), batteryThreshold: "0" }, settings).changes).toEqual({ batteryThreshold: 0 });
  });
});

import { clockText, durationText, nightBar, zoneChoices } from "./site-settings";

describe("night window display", () => {
  it("clockText reads like a clock", () => {
    expect([clockText("00:00"), clockText("06:05"), clockText("12:00"), clockText("21:00"), clockText("nope")]).toEqual(["12:00 AM", "6:05 AM", "12:00 PM", "9:00 PM", "nope"]);
  });
  it("nightBar is one range inside a day and two across midnight", () => {
    expect(nightBar("01:00", "05:00")).toEqual({ ranges: [[60, 300]], totalMinutes: 240 });
    expect(nightBar("21:00", "06:00")).toEqual({ ranges: [[0, 360], [1260, 1440]], totalMinutes: 540 });
  });
  it("nightBar is null for a missing, invalid or empty window", () => {
    expect(nightBar("", "06:00")).toBeNull();
    expect(nightBar("25:00", "06:00")).toBeNull();
    expect(nightBar("06:00", "06:00")).toBeNull();
  });
  it("durationText", () => {
    expect([durationText(540), durationText(570), durationText(45)]).toEqual(["9 h", "9 h 30 min", "45 min"]);
  });
});

describe("zoneChoices", () => {
  const ids = (current: string) => zoneChoices(current).flatMap((g) => g.zones.map((z) => z.id));
  it("groups the zones as Americas, Europe & Africa, Asia & Oceania", () => {
    expect(zoneChoices("America/Los_Angeles").map((g) => g.label)).toEqual(["The Americas", "Europe & Africa", "Asia & Oceania"]);
  });
  it("lists the US zones and the zones added for other regions", () => {
    expect(ids("")).toEqual(expect.arrayContaining(["Pacific/Honolulu", "America/Los_Angeles", "America/Phoenix", "America/New_York", "America/Halifax", "America/Sao_Paulo", "UTC", "Europe/London", "Europe/Berlin", "Africa/Johannesburg", "Europe/Moscow", "Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"]));
  });
  it("every zone is a valid IANA zone and none is listed twice", () => {
    const all = ids("");
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(() => new Intl.DateTimeFormat("en-US", { timeZone: id })).not.toThrow();
  });
  it("adds the site's own zone under Current setting when it is not listed, so an existing setting is not hidden", () => {
    const groups = zoneChoices("Asia/Dubai");
    expect(groups.at(-1)).toEqual({ label: "Current setting", zones: [{ id: "Asia/Dubai", name: null }] });
    expect(zoneChoices("Asia/Kolkata").map((g) => g.label)).not.toContain("Current setting");
  });
});

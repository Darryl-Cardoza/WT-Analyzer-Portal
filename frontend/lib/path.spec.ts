import { describe, expect, it } from "vitest";
import type { GpsFix } from "./alerts";
import { buildPath, sampleStops } from "./path";

const fix = (category: GpsFix["category"], latitude: number, longitude: number): GpsFix => ({
  category, latitude, longitude, gpsTimestamp: null, packetTimestamp: null, hdop: null, satellites: null,
  fixQuality: null, alertBit: null, gpsAgeMinutes: null, packetCount: null, segmentDistanceMeters: null, cumulativeDistanceMeters: null, sensorDocumentId: "x", deviceId: null,
});

describe("buildPath", () => {
  it("runs from the last fix before the alert, through the fixes during it, to the first fix after", () => {
    const { points, estimated } = buildPath([fix("BEFORE", 1, 1), fix("DURING", 2, 2), fix("DURING", 3, 3), fix("AFTER", 4, 4)]);
    expect(points.map((p) => [p.role, p.lat])).toEqual([["start", 1], ["mid", 2], ["mid", 3], ["end", 4]]);
    expect(estimated).toBe(false);
  });

  it("is an estimate when nothing was recorded between the before and after fixes", () => {
    const { points, estimated } = buildPath([fix("BEFORE", 1, 1), fix("AFTER", 4, 4)]);
    expect(points).toHaveLength(2);
    expect(estimated).toBe(true);
  });

  it("is not an estimate for a single fix, and handles no fixes", () => {
    expect(buildPath([fix("BEFORE", 1, 1)]).estimated).toBe(false);
    expect(buildPath([])).toEqual({ points: [], estimated: false });
  });

  it("drops fixes without usable coordinates", () => {
    const { points } = buildPath([fix("BEFORE", NaN, 1), fix("DURING", 2, 2)]);
    expect(points.map((p) => p.lat)).toEqual([2]);
  });
});

describe("sampleStops", () => {
  const nums = (n: number) => Array.from({ length: n }, (_, i) => i);

  it("leaves short paths alone", () => {
    expect(sampleStops(nums(27))).toEqual(nums(27)); // origin + 25 stops + destination
    expect(sampleStops([1])).toEqual([1]);
  });

  it("keeps both ends and at most 25 distinct stops in order, spread across the path", () => {
    const out = sampleStops(nums(100));
    expect(out).toHaveLength(27);
    expect(out[0]).toBe(0);
    expect(out.at(-1)).toBe(99);
    expect(new Set(out).size).toBe(27);
    expect([...out].sort((a, b) => a - b)).toEqual(out);
  });

  it("stays distinct right above the limit", () => {
    const out = sampleStops(nums(28));
    expect(out).toHaveLength(27);
    expect(new Set(out).size).toBe(27);
  });
});

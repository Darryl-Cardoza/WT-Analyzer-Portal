import { describe, expect, it } from "vitest";
import { displayZone, parseZone, siteZoneLabel } from "./timezone";
import { formatDateTime } from "./format";

describe("time zone choice", () => {
  it("is the site zone unless the cookie says utc", () => {
    expect(parseZone("utc")).toBe("utc");
    expect(parseZone("site")).toBe("site");
    expect(parseZone(undefined)).toBe("site");
    expect(parseZone("PST")).toBe("site"); // anything unknown falls back
    expect(parseZone("UTC")).toBe("site"); // only the exact value counts
  });

  it("picks the zone to format with", () => {
    expect(displayZone("utc", "America/Los_Angeles")).toBe("UTC");
    expect(displayZone("site", "America/Los_Angeles")).toBe("America/Los_Angeles");
  });
});

describe("siteZoneLabel", () => {
  it("shows both names for a zone with daylight saving, in any season", () => {
    expect(siteZoneLabel("America/Los_Angeles", 2026)).toBe("PST/PDT");
    expect(siteZoneLabel("America/New_York", 2026)).toBe("EST/EDT");
  });

  it("shows one name for a zone without daylight saving", () => {
    expect(siteZoneLabel("America/Phoenix", 2026)).toBe("MST");
    expect(siteZoneLabel("UTC", 2026)).toBe("UTC");
  });
});

describe("the same instant in both zones", () => {
  it("shows the site time as is and UTC with a label", () => {
    const t = "2026-11-11T21:24:34.970Z"; // 1:24 PM in Los Angeles (PST, UTC-8)
    expect(formatDateTime(t, "America/Los_Angeles", true)).toBe("Nov 11, 1:24:34 PM");
    expect(formatDateTime(t, "UTC", true)).toBe("Nov 11, 9:24:34 PM UTC");
  });

  it("follows daylight saving in the site zone", () => {
    const t = "2026-07-11T21:24:34Z"; // PDT, UTC-7
    expect(formatDateTime(t, "America/Los_Angeles")).toBe("Jul 11, 2:24 PM");
  });
});

// Which time zone times are shown in: the site's own, or UTC. The choice is a cookie, read on the server.

export const ZONE_KEY = "tz"; // localStorage key of the UTC / site-time choice
export type ZoneChoice = "site" | "utc";

/** Anything but "utc" means the site's zone. */
export const parseZone = (value: string | null | undefined): ZoneChoice => (value === "utc" ? "utc" : "site");

/** The IANA zone to format with. */
export const displayZone = (choice: ZoneChoice, siteZone: string): string => (choice === "utc" ? "UTC" : siteZone);

/**
 * "PST/PDT" for a zone with daylight saving, "MST" for one without. The abbreviations come from the zone's January and
 * July names, so the label is right all year. Zones with no short name (e.g. "GMT+5:30") are shown as Intl names them.
 */
export function siteZoneLabel(siteZone: string, year: number = new Date().getUTCFullYear()): string {
  const name = (month: number) =>
    new Intl.DateTimeFormat("en-US", { timeZone: siteZone, timeZoneName: "short" })
      .formatToParts(new Date(Date.UTC(year, month, 15, 12)))
      .find((p) => p.type === "timeZoneName")?.value ?? siteZone;
  const winter = name(0);
  const summer = name(6);
  return winter === summer ? winter : `${winter}/${summer}`;
}

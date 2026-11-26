// The Site Settings form: turning the API's settings into form text, and the form text back into the smallest update to send.
import type { SiteSettings, SiteSettingsChanges } from "./api";

type Settings = SiteSettings["settings"];

export const NUMBER_FIELDS = [
  { key: "distanceThreshold", label: "Distance threshold", unit: "m", group: "gps" },
  { key: "hdopThreshold", label: "HDOP threshold", unit: "", group: "gps" },
  { key: "hdopUpperThreshold", label: "HDOP upper threshold", unit: "", group: "gps" },
  { key: "deviceSwitching", label: "Device switching", unit: "", group: "gps" },
  { key: "batteryThreshold", label: "Battery threshold", unit: "%", group: "alerts" },
  { key: "acknowledgeWaitTime", label: "Acknowledge wait time", unit: "s", group: "alerts" },
] as const;

export const RISKS = [
  { key: "high", label: "High risk" },
  { key: "medium", label: "Medium risk" },
  { key: "low", label: "Low risk" },
] as const;

/** Every input is text, so a half-typed value is never lost. Booleans are "on" / "off" / "" (not set). */
export type Form = Record<string, string>;

const text = (v: number | null) => (v === null ? "" : String(v));

export function toForm(s: Settings): Form {
  const form: Form = { timeZone: s.timeZone ?? "", nightStart: s.nightWindow.startTime, nightEnd: s.nightWindow.endTime };
  for (const f of NUMBER_FIELDS) form[f.key] = text(s[f.key]);
  for (const r of RISKS) {
    form[`${r.key}.soft`] = text(s.fallProfiles[r.key].softFallProbability);
    form[`${r.key}.hard`] = text(s.fallProfiles[r.key].hardFallProbability);
  }
  return form;
}

/**
 * The fields the admin changed, ready to send, plus a message per field that is not a number / not filled in.
 * A field left empty that was never set is skipped; a field that had a value cannot be emptied (the API has no "unset").
 * Ranges are the API's to enforce: its message is shown.
 */
export function diffForm(form: Form, original: Settings): { changes: SiteSettingsChanges; errors: Record<string, string> } {
  const changes: SiteSettingsChanges = {};
  const errors: Record<string, string> = {};

  const number = (key: string, current: number | null): number | undefined => {
    const raw = (form[key] ?? "").trim();
    if (raw === "") {
      if (current !== null) errors[key] = "Enter a value";
      return undefined;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      errors[key] = "Must be a number";
      return undefined;
    }
    return n !== current ? n : undefined;
  };

  for (const f of NUMBER_FIELDS) {
    const n = number(f.key, original[f.key]);
    if (n !== undefined) changes[f.key] = n;
  }

  const zone = (form.timeZone ?? "").trim();
  if (zone === "") {
    if (original.timeZone !== null) errors.timeZone = "Enter a time zone";
  } else if (zone !== original.timeZone) changes.timeZone = zone;

  const [start, end] = [(form.nightStart ?? "").trim(), (form.nightEnd ?? "").trim()];
  if (!start || !end) errors.nightStart = "Enter both a start and an end time";
  else if (start !== original.nightWindow.startTime || end !== original.nightWindow.endTime) changes.nightWindow = { startTime: start, endTime: end };

  for (const r of RISKS) {
    const soft = number(`${r.key}.soft`, original.fallProfiles[r.key].softFallProbability);
    const hard = number(`${r.key}.hard`, original.fallProfiles[r.key].hardFallProbability);
    if (soft !== undefined || hard !== undefined) {
      (changes.fallProfiles ??= {})[r.key] = { ...(soft !== undefined && { softFallProbability: soft }), ...(hard !== undefined && { hardFallProbability: hard }) };
    }
  }
  return { changes, errors };
}

// ---- night window display ----

const minutes = (hhmm: string) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** "21:00" -> "9:00 PM". Anything that is not HH:mm comes back unchanged. */
export function clockText(hhmm: string): string {
  const total = minutes(hhmm);
  if (total === null) return hhmm;
  const h = Math.floor(total / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(total % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * The night window on a 24 hour bar: one range, or two when it crosses midnight (21:00 -> 06:00 is 0-360 and 1260-1440),
 * in minutes from midnight, plus the total length. null while either time is missing or the window is empty.
 */
export function nightBar(start: string, end: string): { ranges: Array<[number, number]>; totalMinutes: number } | null {
  const [s, e] = [minutes(start), minutes(end)];
  if (s === null || e === null || s === e) return null;
  if (s < e) return { ranges: [[s, e]], totalMinutes: e - s };
  return { ranges: [[0, e], [s, 1440]], totalMinutes: 1440 - s + e };
}

/** "9 h", "9 h 30 min", "45 min". */
export function durationText(totalMinutes: number): string {
  const [h, m] = [Math.floor(totalMinutes / 60), totalMinutes % 60];
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

// ---- time zone choices ----

export interface ZoneOption {
  id: string; // the IANA zone the API stores
  name: string | null; // a readable name; null for a site's own zone that is not in the list
}

/**
 * The time zones a site can pick, grouped as the dropdown shows them, west to east. Each is one IANA zone that stands for
 * the region (zones that observe daylight saving keep doing so). Arizona is listed apart from Mountain Time: it has no DST.
 */
export const ZONE_GROUPS: Array<{ label: string; zones: ZoneOption[] }> = [
  {
    label: "The Americas",
    zones: [
      { id: "Pacific/Honolulu", name: "Hawaii Time" },
      { id: "America/Anchorage", name: "Alaska Time" },
      { id: "America/Los_Angeles", name: "Pacific Time" },
      { id: "America/Denver", name: "Mountain Time" },
      { id: "America/Phoenix", name: "Mountain Time (Arizona, no daylight saving)" },
      { id: "America/Chicago", name: "Central Time" },
      { id: "America/New_York", name: "Eastern Time" },
      { id: "America/Halifax", name: "Atlantic Time" },
      { id: "America/Sao_Paulo", name: "Brasília Time" },
    ],
  },
  {
    label: "Europe & Africa",
    zones: [
      { id: "UTC", name: "UTC" },
      { id: "Europe/London", name: "Greenwich Mean Time (UK, Ireland, Portugal)" },
      { id: "Europe/Berlin", name: "Central European Time" },
      { id: "Africa/Johannesburg", name: "Eastern European / Central Africa Time" },
      { id: "Europe/Moscow", name: "Moscow / East Africa Time" },
    ],
  },
  {
    label: "Asia & Oceania",
    zones: [
      { id: "Asia/Kolkata", name: "India Standard Time" },
      { id: "Asia/Shanghai", name: "China Standard Time" },
      { id: "Asia/Tokyo", name: "Japan / Korea Standard Time" },
      { id: "Australia/Sydney", name: "Australian Eastern Time" },
      { id: "Pacific/Auckland", name: "New Zealand Time" },
    ],
  },
];

/**
 * What the dropdown offers: the groups above, plus the site's own zone under "Current setting" when it is none of them,
 * so an existing setting is never hidden or silently changed just by opening the page.
 */
export function zoneChoices(current: string): Array<{ label: string; zones: ZoneOption[] }> {
  const listed = ZONE_GROUPS.some((g) => g.zones.some((z) => z.id === current));
  return current && !listed ? [...ZONE_GROUPS, { label: "Current setting", zones: [{ id: current, name: null }] }] : ZONE_GROUPS;
}

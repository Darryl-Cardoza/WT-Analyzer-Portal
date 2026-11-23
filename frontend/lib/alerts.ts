// Alert list types and the small pure helpers behind the Alerts page (no server-only code, so they are testable).

export interface AlertSummary {
  id: string;
  alertType: string;
  alertStatus: string;
  alertTitle: string | null;
  resident: string;
  /** The resident’s full name, when the API could read it; null otherwise (the user ID is always shown). */
  residentName: string | null;
  startedAt: string;
  endedAt: string | null;
  isFalsePositive: boolean | null;
  /** "day" or "night" in the site's time zone and night window; null when the time is unusable. */
  period?: "day" | "night" | null;
  /** BLE / LTE for Nest (geofence) alerts; null for alert types that have no source. */
  source: "BLE" | "LTE" | "Unknown" | null;
}

export interface SearchResponse {
  timeZone: string;
  count: number;
  /** How many of the alerts started in the site's day / night hours (the site's own night window and time zone). */
  dayNight?: { day: number; night: number };
  alerts: AlertSummary[];
}

// ---- GET /alerts/:id ----

export interface Coord {
  lat: number;
  lon: number;
}

export interface FallAnalysis {
  type: "FALL";
  parsed: boolean; // false: the title did not match "<Soft|Hard> Fall - N% probability"
  fallKind: "soft" | "hard" | null;
  probability: number | null;
  residentRisk: string | null; // high | medium | low
  threshold: number | null; // the site's value for this risk level and fall kind
  meetsThreshold: boolean | null;
  alertLocation: Coord | null;
  baseLocation: Coord | null;
  distanceFromBaseMeters: number | null;
  isFalsePositive: boolean | null;
  /** The resident's other falls in the 30 days up to this one, newest first. */
  recentFalls?: RecentFall[];
  /** Of those recent falls, how many started in the site's day / night hours (site time zone + night window). */
  dayNight?: { day: number; night: number };
  /** Geofences ("nests") assigned to the resident, as polygons; empty when none. */
  nests?: { name: string | null; address: string | null; isActive: boolean | null; points: Coord[] }[];
  /** Sensor packets from just before the alert until the all-zero alertBit packet. */
  packets?: FallPacket[];
  acknowledgedAt?: string | null;
  /** Seconds from the alert start to the acknowledgement. */
  acknowledgedSeconds?: number | null;
  resolution?: FallResolution;
  notes?: string[];
}

export interface FallPacket {
  category: "BEFORE" | "ALERT" | "RESOLVED";
  packetTimestamp: string;
  offsetSeconds: number;
  alertBit: string | null;
  payloadType: string | null;
  deviceId: string | null;
  latitude: number | null;
  longitude: number | null;
  sensorDocumentId: string;
  /** Set only on the packet nearest the acknowledgement: packet time minus acknowledgement time, in seconds. */
  acknowledgedDeltaSeconds?: number | null;
}

export interface FallResolution {
  status: "RESOLVED" | "NOT_FOUND" | "NO_FLAG" | "UNAVAILABLE";
  seconds: number | null;
  resolvedAt: string | null;
  exceededLimit: boolean;
  limitSeconds: number;
  /** acknowledgmentDetails.completedAt, and the time from the alert start to it. */
  completedAt?: string | null;
  completedSeconds?: number | null;
}

/** How slow the caregiver was to act: 2 to 4 hours is a caution (yellow), over 4 hours is red. */
export function slowTone(seconds: number | null | undefined): "neutral" | "caution" | "danger" {
  if (seconds == null) return "neutral";
  return seconds > 4 * 3600 ? "danger" : seconds >= 2 * 3600 ? "caution" : "neutral";
}

/** GPS signal strength from an HDOP reading: up to 2 strong, up to 4.5 medium, anything else weak. */
export function hdopSignal(hdop: number | null | undefined): { label: string; tone: "neutral" | "ok" | "caution" | "danger" } {
  if (hdop == null) return { label: "No reading", tone: "neutral" };
  if (hdop >= 0.1 && hdop <= 2) return { label: "Strong signal", tone: "ok" };
  if (hdop > 2 && hdop <= 4.5) return { label: "Medium signal", tone: "caution" };
  return { label: "Weak signal", tone: "danger" };
}

export interface RecentFall {
  id: string;
  startedAt: string;
  /** "day" or "night" in the site's time zone and night window; null when the time is unusable. */
  period?: "day" | "night" | null;
  title: string | null;
  fallKind: "soft" | "hard" | null;
  probability: number | null;
  isFalsePositive: boolean | null;
  /** Why it was a false positive (null otherwise). */
  reason?: string | null;
  acknowledgedAt?: string | null;
  completedAt?: string | null;
  location: Coord | null;
}

/** Marker colour and wording for a fall's review outcome: true fall, false positive, or not acknowledged. */
export function fallOutcome(isFalsePositive: boolean | null) {
  return isFalsePositive === null
    ? { label: "Not acknowledged", color: "#6b7280" }
    : isFalsePositive
      ? { label: "False positive", color: "#1a73e8" }
      : { label: "True fall", color: "#b42323" };
}

/** Marker colour per type and outcome: hard+true red, hard+false positive blue, soft+true green, soft+false positive yellow; grey when not acknowledged. */
export function fallColor(kind: "soft" | "hard" | null, isFalsePositive: boolean | null) {
  if (isFalsePositive === null) return "#6b7280";
  if (kind === "soft") return isFalsePositive ? "#eab308" : "#16a34a";
  return isFalsePositive ? "#1a73e8" : "#b42323";
}

export interface DoorAnalysis {
  type: "DOOR";
  door: string | null;
  resident: string | null;
  time: string | null;
  falsePositive: "Yes" | "No" | "Not Classified";
  alertBit: string | null;
  /** The resident's other door alerts in the 20 days up to this one, newest first. */
  recentDoors?: RecentDoor[];
  /** Door alert counts over the 20 days up to this one (this alert excluded): true positives vs false positive / not classified. */
  doorUsage?: { door: string; truePositive: number; other: number }[];
  /** Of those recent door alerts, how many started in the site's day / night hours (site time zone + night window). */
  dayNight?: { day: number; night: number };
}

export interface RecentDoor {
  id: string;
  /** "day" or "night" in the site's time zone and night window; null when the time is unusable. */
  period?: "day" | "night" | null;
  startedAt: string;
  door: string | null;
  falsePositive: "Yes" | "No" | "Not Classified";
  reason: string | null;
  acknowledgedAt: string | null;
  completedAt: string | null;
}

/** One GPS fix around the alert. BEFORE / AFTER are context; DURING fixes make up the measured path. */
export interface GpsFix {
  category: "BEFORE" | "DURING" | "AFTER";
  gpsTimestamp: string | null;
  packetTimestamp: string | null;
  latitude: number;
  longitude: number;
  hdop: number | null;
  satellites: number | null;
  fixQuality: number | null;
  alertBit: string | null; // the device’s alert flags in the packet that carried this fix
  gpsAgeMinutes: number | null;
  /** Packets inside the alert window that carried this same GPS fix; null for BEFORE and AFTER. */
  packetCount: number | null;
  segmentDistanceMeters: number | null;
  cumulativeDistanceMeters: number | null;
  sensorDocumentId: string;
  deviceId: string | null; // the device whose packet carried this fix
}

export interface GeofenceAnalysis {
  type: "GEOFENCE";
  deviceId: string;
  window: { start: string | null; end: string | null; valid: boolean };
  alertSource: {
    source: "BLE" | "LTE" | "Unknown";
    confidence: string;
    reason: string;
    candidateCount: number;
    trigger: {
      rawPayloadType: string;
      packetTimestamp: string;
      offsetSeconds: number;
      alertBit: string | null;
      sensorDocumentId: string;
    } | null;
  };
  alertHdop: number | null;
  freshGpsFixes: number;
  fixesWithCoordinates: number;
  fixesWithHdop: number;
  averageHdop: number | null;
  hdopAboveThreshold: boolean | null; // vs the site's hdopThreshold
  distanceTravelledMeters: number | null;
  gpsCoverage: string;
  alertLocation: Coord | null;
  baseLocation: Coord | null;
  distanceFromBaseMeters: number | null;
  beyondDistanceThreshold: boolean | null; // vs the site's distanceThreshold
  gpsFixes: GpsFix[];
  /** Geofences ("nests") assigned to the resident, as polygons; empty when none. */
  nests: { name: string | null; address: string | null; isActive: boolean | null; points: Coord[] }[];
  sensorDocumentIds: string[];
  isFalsePositive: boolean | null;
  notes: string[];
  /** The resident's other Nest alerts in the 20 days up to this one, newest first. */
  recentGeofences?: RecentGeofence[];
  /** Of those recent Nest alerts, how many started in the site's day / night hours (site time zone + night window). */
  dayNight?: { day: number; night: number };
}

export interface RecentGeofence {
  id: string;
  /** "day" or "night" in the site's time zone and night window; null when the time is unusable. */
  period?: "day" | "night" | null;
  startedAt: string;
  source: "BLE" | "LTE" | "Unknown" | null;
  falsePositive: "Yes" | "No" | "Not Classified";
  reason: string | null;
  acknowledgedAt: string | null;
  completedAt: string | null;
}

export type Analysis = FallAnalysis | DoorAnalysis | GeofenceAnalysis | null;

export interface AlertDetail {
  timeZone: string;
  alert: AlertSummary & {
    deviceId: string | null;
    acknowledgment: {
      acknowledged: boolean | null;
      acknowledgedAt: string | null;
      completedAt: string | null;
      notes: string | null;
      acknowledgedBy: string | null;
    };
  };
  resident: {
    name: string | null;
    weartechUserId: string;
    deviceId: string | null;
    fallProfile: string | null;
    baseLocation: { baseLatitude: string; baseLongitude: string } | null;
  };
  analysis: Analysis;
}

/** Type chips in the order AdminOps shows them. "Nest" is the geofence alert. */
export const TYPE_FILTERS = [
  { value: "DOOR_CHANGE", label: "Door" },
  { value: "GEOFENCE", label: "Nest" },
  { value: "AI_FALL_DETECTION", label: "Fall" },
] as const;

/** "AUTO_ACKNOWLEDGED" -> "Auto Acknowledged" */
export const humanize = (value: string | null | undefined) =>
  String(value ?? "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

export const typeLabel = (type: string) => TYPE_FILTERS.find((f) => f.value === type)?.label ?? (humanize(type) || "Unknown");

export interface Filters {
  email?: string;
  date?: string;
  time?: string;
  toDate?: string;
  toTime?: string;
  type?: string;
  status?: string;
  source?: string;
  fp?: string; // "yes" | "no" | "none" (false positive / true positive / not classified)
  page?: string; // 1-based page of the list
}

export const PAGE_SIZE = 30;

/** One page of a list. A missing, junk or out-of-range page falls back to the nearest valid one. */
export function paginate<T>(items: T[], page: string | undefined) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(Math.max(parseInt(page ?? "", 10) || 1, 1), totalPages);
  const start = (current - 1) * PAGE_SIZE;
  return { items: items.slice(start, start + PAGE_SIZE), page: current, totalPages, start };
}

/** A URL query value can be a string, a repeated string[] or missing: take the first non-blank string. */
export const one = (value: string | string[] | undefined): string | undefined => {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() ? v.trim() : undefined;
};

/** One value from the page's URL query (see `one`): the first non-blank, trimmed string, or undefined. */
export const param = (sp: { get(name: string): string | null }, name: string): string | undefined => one(sp.get(name) ?? undefined);

/** The type filter is one or more type values, comma separated in the URL ("DOOR_CHANGE,AI_FALL_DETECTION"). */
export const typeList = (value: string | undefined): string[] => (value ? value.split(",").filter(Boolean) : []);

/** Only known type values are accepted from the URL; the result is those values in chip order, comma separated, or undefined. */
export const validType = (value: string | undefined) => {
  const wanted = new Set(typeList(value));
  const valid = TYPE_FILTERS.filter((f) => wanted.has(f.value)).map((f) => f.value);
  return valid.length ? valid.join(",") : undefined;
};

/** The type filter after clicking `clicked`: added if it was off, removed if it was on. undefined (= all types) when none are left. */
export const toggleType = (current: string | undefined, clicked: string) => {
  const set = new Set(typeList(current));
  if (!set.delete(clicked)) set.add(clicked);
  return validType([...set].join(","));
};

/** Status, source and false-positive filters are lists too (comma separated in the URL). Adds `clicked` if it was off, removes it if on; undefined when none are left. */
export const toggleValue = (current: string | undefined, clicked: string) => {
  const set = new Set(typeList(current));
  if (!set.delete(clicked)) set.add(clicked);
  return set.size ? [...set].join(",") : undefined;
};

/** Link to the Alerts page with these filters; blank ones are left out of the URL. */
export function alertsHref(filters: Filters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/alerts/?${query}` : "/alerts/"; // trailing slash: the static host serves /alerts/index.html
}

const FILTER_KEYS = ["email", "date", "time", "toDate", "toTime", "type", "status", "source", "fp", "page"] as const;

/**
 * Link to an alert's page. It is one static page that reads the id from the URL (a static site cannot have a page per
 * alert), and it remembers the search it was opened from (the `from` query string).
 */
export function detailHref(id: string, filters: Filters): string {
  const from = alertsHref(filters).split("?")[1];
  const base = `/alert/?id=${encodeURIComponent(id)}`;
  return from ? `${base}&from=${encodeURIComponent(from)}` : base;
}

/** The "Back to results" link. `from` comes from the URL, so only known filter keys are rebuilt into a fixed /alerts path. */
export function backHref(from: string | undefined): string {
  const params = new URLSearchParams(from ?? "");
  const filters: Filters = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key)?.trim();
    if (value) filters[key] = value;
  }
  filters.type = validType(filters.type);
  filters.source = validSource(filters.source);
  filters.fp = validFp(filters.fp);
  if (!/^\d{1,6}$/.test(filters.page ?? "")) delete filters.page;
  return alertsHref(filters);
}

export const SOURCES = ["BLE", "LTE", "Unknown"] as const;
/** The False Positive chips. The URL value is a short word; `value` is what the alert carries. */
export const FALSE_POSITIVE_FILTERS = [
  { key: "yes", label: "Yes", value: true },
  { key: "no", label: "No", value: false },
  { key: "none", label: "Not classified", value: null },
] as const;

/** Only known values are accepted from the URL. */
export const validSource = (value: string | undefined) => {
  const wanted = new Set(typeList(value));
  const valid = SOURCES.filter((s) => wanted.has(s));
  return valid.length ? valid.join(",") : undefined;
};
export const validFp = (value: string | undefined) => {
  const wanted = new Set(typeList(value));
  const valid = FALSE_POSITIVE_FILTERS.filter((f) => wanted.has(f.key)).map((f) => f.key);
  return valid.length ? valid.join(",") : undefined;
};

/** Type, status, source and false positive are filtered here, so the chips always reflect the whole search result. */
export function applyFilters(alerts: AlertSummary[], { type, status, source, fp }: Pick<Filters, "type" | "status" | "source" | "fp">) {
  // Each filter is a list: an alert passes a filter when it matches any selected value, and must pass every filter.
  const types = typeList(type);
  const statuses = typeList(status);
  const sources = typeList(source);
  const fpValues = typeList(fp).map((k) => FALSE_POSITIVE_FILTERS.find((f) => f.key === k)?.value);
  return alerts.filter(
    (a) =>
      (!types.length || types.includes(a.alertType)) &&
      (!statuses.length || statuses.includes(a.alertStatus)) &&
      (!sources.length || sources.includes(a.source as string)) &&
      (!fpValues.length || fpValues.includes(a.isFalsePositive ?? null)),
  );
}

/** Status chips come from the statuses actually present, so no status values are hard-coded. */
export const KNOWN_STATUSES = ["AUTO_ACKNOWLEDGED", "RESOLVED"];
/** Known statuses plus any other present; the caller dims the ones with no alerts. */
export function statusOptions(alerts: AlertSummary[]): string[] {
  return [...new Set([...KNOWN_STATUSES, ...alerts.map((a) => a.alertStatus).filter(Boolean)])].sort();
}

/** Source chips: only the sources present (Nest alerts only), in a fixed order. Empty when there are no Nest alerts. */
export function sourceOptions(alerts: AlertSummary[]) {
  return SOURCES.filter((s) => alerts.some((a) => a.source === s));
}

/** False Positive chips: every outcome in a fixed order; `present` is false when no alert has it (shown dimmed). */
export function falsePositiveOptions(alerts: AlertSummary[]) {
  return FALSE_POSITIVE_FILTERS.map((f) => ({ ...f, present: alerts.some((a) => (a.isFalsePositive ?? null) === f.value) }));
}

/**
 * The API's `from`/`to` (site-zone ISO) when the admin gave a To date, else undefined (single date search).
 * Without a To time the range runs to the end of the To date (the API's end is exclusive, so the next midnight).
 */
export function searchRange({ date, time, toDate, toTime }: Pick<Filters, "date" | "time" | "toDate" | "toTime">) {
  if (!date || !toDate) return undefined;
  const nextDay = new Date(Date.parse(`${toDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return { from: `${date}T${time || "00:00"}`, to: toTime ? `${toDate}T${toTime}` : `${nextDay}T00:00` };
}

// Date/time display in the site's time zone. Intl only, no date library.

/** Today's date (yyyy-MM-dd) in a time zone; the default search date. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * "Nov 11, 1:24 PM" in the given zone ("Nov 11, 1:24:29 PM" with `seconds`, for GPS fixes).
 * Newer ICU puts a narrow no-break space before PM, so it is normalised. UTC times end in " UTC" so they are never
 * mistaken for site time.
 */
export function formatDateTime(value: string | Date | null | undefined, timeZone: string, seconds = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" as const } : {}),
  })
    .format(date)
    .replace(/\s/g, " ");
  return timeZone === "UTC" ? `${text} UTC` : text;
}

/** 41 -> "41s", 123 -> "2m 3s", 3900 -> "1h 5m". */
export function formatSeconds(total: number): string {
  const s = Math.round(total);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** How old a GPS fix was when its packet arrived: 0.02 -> "1s", 1.5 -> "1m 30s". */
export function formatAge(minutes: number | null | undefined): string {
  return minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0 ? "—" : formatSeconds(minutes * 60);
}

/** A packet's time relative to the alert start: "6.0 s after the alert started". */
export function formatOffset(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  if (seconds === 0) return "at the alert start";
  return `${Math.abs(seconds).toFixed(1)} s ${seconds > 0 ? "after" : "before"} the alert started`;
}

/** "41s", "2m 3s", "1h 5m". Null when either time is missing or the end is before the start. */
export function formatDuration(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(ms) && ms >= 0 ? formatSeconds(ms / 1000) : null;
}

/** "79 m" under a kilometre, "1.25 km" above. */
export function formatMeters(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return "—";
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

/** "Nov 12, 2026" for a yyyy-MM-dd date string (no zone shift: it is a calendar date). */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

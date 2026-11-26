import type { AlertDetail, SearchResponse } from "./alerts";
import { clearToken, getToken } from "./session";

// The analyzer API: Mahi-Backend's /api/alert-analyzer routes, called straight from the browser. NEXT_PUBLIC_ values are
// public and fixed at build time (rebuild after changing them); there is no secret in this app.
export const API_URL = process.env.NEXT_PUBLIC_ANALYZER_API_URL ?? "http://localhost:4000";

/** A non-2xx answer from the API (other than a refused session, which is a SessionError). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** No token, or the API refused it (expired, revoked, no longer a site admin). The session is already cleared: show the login page. */
export class SessionError extends Error {
  constructor() {
    super("Your session has ended");
  }
}

/** GET a protected API route as the signed-in admin. Browser only. */
export async function apiFetch<T>(path: string): Promise<T> {
  const token = getToken();
  if (!token) throw new SessionError();

  const res = await fetch(`${API_URL}${path}`, {
    headers: { "x-access-token": token, "ngrok-skip-browser-warning": "true" }, // ngrok header: dev tunnel only, harmless elsewhere
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    clearToken();
    throw new SessionError();
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
    throw new ApiError(res.status, typeof body?.message === "string" ? body.message : `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface Me {
  weartechUserId: string;
  site: { id: string; name: string | null; timeZone: string };
}

// The header and the page both need /me: ask once per token. Keyed by token so a new sign-in is never served the previous user.
let cachedMe: { token: string | null; request: Promise<Me> } | null = null;
export function getMe(): Promise<Me> {
  const token = getToken();
  if (!cachedMe || cachedMe.token !== token) {
    const request = apiFetch<Me>("/me");
    const entry = { token, request };
    cachedMe = entry;
    request.catch(() => {
      if (cachedMe === entry) cachedMe = null; // a failure is never cached
    });
  }
  return cachedMe.request;
}

/** One alert with its analysis. 404 (ApiError) when it does not exist or belongs to another site. */
export const getAlert = (id: string) => apiFetch<AlertDetail>(`/alerts/${encodeURIComponent(id)}`);

/** Alerts for the admin's site. `date`/`time`/`from`/`to` are read in `tz` (an IANA zone, e.g. "UTC"), else the site's zone; `time` narrows to +/-15 minutes. */
export function searchAlerts(params: { email?: string; date?: string; time?: string; from?: string; to?: string; tz?: string }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  return apiFetch<SearchResponse>(`/alerts?${query}`);
}

export interface FallProfile {
  softFallProbability: number | null;
  hardFallProbability: number | null;
}

/** The admin's own site and its settings (read-only). A value the site has not set is null. */
export interface SiteSettings {
  site: { id: string; name: string | null; timeZone: string };
  settings: {
    timeDifferenceThreshold: number | null;
    batteryThreshold: number | null;
    firstPacketDetection: boolean | null;
    deviceSwitching: number | null;
    acknowledgeWaitTime: number | null;
    distanceThreshold: number | null;
    hdopThreshold: number | null;
    hdopUpperThreshold: number | null;
    timeZone: string | null;
    /** isDefault: the site has not set a window, so the default one applies. */
    nightWindow: { startTime: string; endTime: string; isDefault: boolean };
    showBatteryAlert: boolean | null;
    fallProfiles: { high: FallProfile; medium: FallProfile; low: FallProfile };
  };
}

export const getSiteSettings = () => apiFetch<SiteSettings>("/site-settings");

/** POST JSON to a protected API route as the signed-in admin. Same session and error rules as apiFetch. Browser only. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  if (!token) throw new SessionError();

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "x-access-token": token, "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    clearToken();
    throw new SessionError();
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: unknown } | null;
    throw new ApiError(res.status, typeof err?.message === "string" ? err.message : `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** The body of a settings update: any subset of the settings. */
export type SiteSettingsChanges = {
  [K in Exclude<keyof SiteSettings["settings"], "nightWindow" | "fallProfiles">]?: NonNullable<SiteSettings["settings"][K]>;
} & {
  nightWindow?: { startTime: string; endTime: string };
  fallProfiles?: { [R in "high" | "medium" | "low"]?: Partial<{ softFallProbability: number; hardFallProbability: number }> };
};

/** Changes the given site settings (only the fields sent) and returns the settings as they are now. */
export const saveSiteSettings = (changes: SiteSettingsChanges) => apiPost<SiteSettings>("/site-settings", changes);

/** Fired when the site's /me answer is out of date (e.g. its time zone was changed), so what shows it can load it again. */
export const ME_CHANGED = "analyzer:me-changed";

/** Forget the cached /me answer, and tell the header (already on screen) to load the new one, so no page reload is needed. */
export function clearMeCache() {
  cachedMe = null;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ME_CHANGED));
}

// This is a static app: there is no server to hold an httpOnly cookie, so the access token lives in sessionStorage.
// Page scripts can read it (the Content-Security-Policy is the defence), but it is per tab and gone when the tab closes.
// Browser only: call these from event handlers and effects. Where storage is missing (prerender) or blocked, there is no session.
export const SESSION_KEY = "analyzer_session";

export function getToken(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as { token?: unknown; expiresAt?: unknown } | null;
    if (typeof s?.token === "string" && s.token && typeof s.expiresAt === "number" && Date.now() < s.expiresAt) return s.token;
    sessionStorage.removeItem(SESSION_KEY); // expired, or not ours
  } catch {
    // storage blocked, or not JSON: no session
  }
  return null;
}

/** False when the browser refused to store it (the caller should say so instead of bouncing back to the login page). */
export function setToken(token: string, maxAgeSeconds: number): boolean {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt: Date.now() + maxAgeSeconds * 1000 }));
    return true;
  } catch {
    return false;
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // nothing to clear
  }
}

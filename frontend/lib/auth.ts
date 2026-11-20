import { API_URL } from "./api";
import { clearToken, setToken } from "./session";

export type LoginResult = { error?: string };

const MESSAGES: Record<number, string> = {
  400: "Enter your user ID and password.",
  401: "Incorrect user ID or password.",
  403: "This account is not a site admin.",
  429: "Too many failed attempts. Try again in 15 minutes.",
};
const GENERIC = "Something went wrong. Please try again.";

/** Signs in against the analyzer API from the browser and keeps the token for its lifetime. Never throws: failures come back as a message. */
export async function login(weartechUserId: string, password: string): Promise<LoginResult> {
  const id = weartechUserId.trim();
  if (!id || !password) return { error: MESSAGES[400] };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weartechUserId: id, password }), // the password is sent as typed, not trimmed
      cache: "no-store",
    });
  } catch {
    return { error: "Cannot reach the server. Please try again shortly." };
  }
  if (!res.ok) return { error: MESSAGES[res.status] ?? GENERIC };

  // A 200 that is not a sign-in answer (e.g. the URL points at a web page) must not count as signed in.
  const body = (await res.json().catch(() => null)) as { accessToken?: unknown; expiresInSeconds?: unknown } | null;
  if (typeof body?.accessToken !== "string" || !body.accessToken || typeof body.expiresInSeconds !== "number") return { error: GENERIC };

  if (!setToken(body.accessToken, body.expiresInSeconds)) {
    return { error: "Your browser would not store the sign-in. Allow site data for this page and try again." };
  }
  return {};
}

export function logout() {
  clearToken();
}

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./session", () => ({ getToken: vi.fn(), clearToken: vi.fn() }));

import { API_URL, ApiError, SessionError, apiFetch, getAlert, getMe, searchAlerts } from "./api";
import { clearToken, getToken } from "./session";

const fetchMock = vi.fn();
const reply = (status: number, body: unknown, jsonFails = false) =>
  fetchMock.mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: jsonFails ? async () => { throw new SyntaxError("bad json"); } : async () => body,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(getToken).mockReturnValue("tok");
});

describe("apiFetch", () => {
  it("sends the token (and no API key), never caches, and returns the JSON", async () => {
    reply(200, { hello: "world" });
    await expect(apiFetch("/x")).resolves.toEqual({ hello: "world" });
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/x`, { headers: { "x-access-token": "tok", "ngrok-skip-browser-warning": "true" }, cache: "no-store" });
  });

  it("rejects with a SessionError, without calling the API, when there is no token", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    await expect(apiFetch("/x")).rejects.toBeInstanceOf(SessionError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 403])("a %i clears the session and rejects with a SessionError", async (status) => {
    reply(status, {});
    await expect(apiFetch("/x")).rejects.toBeInstanceOf(SessionError);
    expect(clearToken).toHaveBeenCalledTimes(1);
  });

  it("keeps the session for other errors and throws an ApiError with the API's message", async () => {
    reply(404, { message: "Alert not found" });
    const err = await apiFetch("/x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, message: "Alert not found" });
    expect(clearToken).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the body is not JSON or has no string message", async () => {
    reply(500, null, true);
    expect(await apiFetch("/x").catch((e) => e)).toMatchObject({ status: 500, message: "Request failed (500)" });
    reply(400, { message: ["array", "of", "errors"] });
    expect(await apiFetch("/x").catch((e) => e)).toMatchObject({ status: 400, message: "Request failed (400)" });
    reply(502, null);
    expect(await apiFetch("/x").catch((e) => e)).toMatchObject({ status: 502, message: "Request failed (502)" });
  });

  it("lets a network failure (offline, CORS) through as it is, keeping the session", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiFetch("/x")).rejects.toThrow("Failed to fetch");
    expect(clearToken).not.toHaveBeenCalled();
  });
});

describe("endpoint helpers", () => {
  it("getMe calls /me", async () => {
    vi.mocked(getToken).mockReturnValue("tok-me");
    reply(200, { weartechUserId: "a" });
    await getMe();
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/me`);
  });

  it("getAlert URL-encodes the id", async () => {
    reply(200, {});
    await getAlert("a/b c");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/alerts/a%2Fb%20c`);
  });

  it("searchAlerts sends only the filters that are set", async () => {
    reply(200, { alerts: [] });
    await searchAlerts({ email: "a@b.c", date: "2026-11-11", time: "", from: undefined, to: "2026-11-12T00:00" });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname.endsWith("/alerts")).toBe(true);
    expect(Object.fromEntries(url.searchParams)).toEqual({ email: "a@b.c", date: "2026-11-11", to: "2026-11-12T00:00" });
  });

  it("searchAlerts with no filters asks for /alerts with an empty query", async () => {
    reply(200, { alerts: [] });
    await searchAlerts({});
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/alerts?`);
  });
});

// Each test uses its own token: the cache is keyed by token, so tests do not leak into each other.
describe("getMe cache", () => {
  const as = (token: string | null) => vi.mocked(getToken).mockReturnValue(token);

  it("asks the API once per token", async () => {
    as("cache-1");
    reply(200, { weartechUserId: "a" });
    expect(await getMe()).toEqual({ weartechUserId: "a" });
    expect(await getMe()).toEqual({ weartechUserId: "a" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares one request between simultaneous callers", async () => {
    as("cache-2");
    reply(200, { weartechUserId: "b" });
    await Promise.all([getMe(), getMe(), getMe()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks again for a different token: a new sign-in is never served the previous user", async () => {
    as("cache-3a");
    reply(200, { weartechUserId: "first" });
    expect(await getMe()).toEqual({ weartechUserId: "first" });
    as("cache-3b");
    reply(200, { weartechUserId: "second" });
    expect(await getMe()).toEqual({ weartechUserId: "second" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failure", async () => {
    as("cache-4");
    reply(500, { message: "boom" });
    await expect(getMe()).rejects.toBeInstanceOf(ApiError);
    reply(200, { weartechUserId: "ok" });
    expect(await getMe()).toEqual({ weartechUserId: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects with a SessionError when there is no token", async () => {
    as(null);
    await expect(getMe()).rejects.toBeInstanceOf(SessionError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./session", () => ({ getToken: vi.fn(), setToken: vi.fn(() => true), clearToken: vi.fn() }));

import { API_URL } from "./api";
import { login, logout } from "./auth";
import { clearToken, setToken } from "./session";

const fetchMock = vi.fn();
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setToken).mockReturnValue(true);
  vi.stubGlobal("fetch", fetchMock);
});

describe("login", () => {
  it.each([
    ["both empty", "", ""],
    ["no password", "a@b.c", ""],
    ["no user id", "", "pw"],
    ["blank user id", "   ", "pw"],
  ])("asks for both fields without calling the API: %s", async (_name, id, pw) => {
    expect(await login(id, pw)).toEqual({ error: "Enter your user ID and password." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the trimmed user id and the password as JSON, uncached, with no API key", async () => {
    fetchMock.mockResolvedValue(ok({ accessToken: "t", expiresInSeconds: 60 }));
    await login("  admin@site.org  ", " pw ");
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weartechUserId: "admin@site.org", password: " pw " }), // the password is not trimmed
      cache: "no-store",
    });
  });

  it("stores the token for its lifetime and reports no error on success", async () => {
    fetchMock.mockResolvedValue(ok({ accessToken: "tok", expiresInSeconds: 43200 }));
    expect(await login("admin@site.org", "pw")).toEqual({});
    expect(setToken).toHaveBeenCalledWith("tok", 43200);
  });

  it.each([
    [400, "Enter your user ID and password."],
    [401, "Incorrect user ID or password."],
    [403, "This account is not a site admin."],
    [429, "Too many failed attempts. Try again in 15 minutes."],
    [500, "Something went wrong. Please try again."],
    [503, "Something went wrong. Please try again."],
  ])("maps a %i answer to a message and stores nothing", async (status, error) => {
    fetchMock.mockResolvedValue({ ok: false, status });
    expect(await login("admin@site.org", "pw")).toEqual({ error });
    expect(setToken).not.toHaveBeenCalled();
  });

  it("reports an unreachable server (offline, or the browser blocked the request)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await login("admin@site.org", "pw")).toEqual({ error: "Cannot reach the server. Please try again shortly." });
    expect(setToken).not.toHaveBeenCalled();
  });

  it.each([
    ["not JSON (e.g. the URL points at a web page)", { ok: true, status: 200, json: async () => { throw new SyntaxError("bad json"); } }],
    ["no token", ok({})],
    ["a token that is not text", ok({ accessToken: 123, expiresInSeconds: 60 })],
    ["no lifetime", ok({ accessToken: "t" })],
  ])("does not sign in on a 200 that is %s", async (_name, reply) => {
    fetchMock.mockResolvedValue(reply);
    expect(await login("admin@site.org", "pw")).toEqual({ error: "Something went wrong. Please try again." });
    expect(setToken).not.toHaveBeenCalled();
  });

  it("says so when the browser refuses to store the session, instead of bouncing back to the login page", async () => {
    fetchMock.mockResolvedValue(ok({ accessToken: "t", expiresInSeconds: 60 }));
    vi.mocked(setToken).mockReturnValue(false);
    const { error } = await login("admin@site.org", "pw");
    expect(error).toMatch(/browser/i);
  });
});

describe("logout", () => {
  it("clears the session", () => {
    logout();
    expect(clearToken).toHaveBeenCalledTimes(1);
  });
});

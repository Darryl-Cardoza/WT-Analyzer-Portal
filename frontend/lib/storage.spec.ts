// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY, clearToken, getToken, setToken } from "./session";
import { ZONE_KEY } from "./timezone";
import { getZoneChoice, setZoneChoice, useZoneChoice } from "./zone-pref";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("session token (sessionStorage)", () => {
  it("is null when nothing is stored", () => {
    expect(getToken()).toBeNull();
  });

  it("stores the token and reads it back", () => {
    expect(setToken("tok", 60)).toBe(true);
    expect(getToken()).toBe("tok");
  });

  it("is gone once its lifetime has passed, and the stale entry is removed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    setToken("tok", 60);
    vi.setSystemTime(59_999);
    expect(getToken()).toBe("tok");
    vi.setSystemTime(60_000);
    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("clearToken removes it", () => {
    setToken("tok", 60);
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("lives only in sessionStorage: not shared with other tabs, gone when the tab closes", () => {
    setToken("tok", 60);
    expect(localStorage.length).toBe(0);
  });

  it.each([["not json"], ["{}"], ['{"token":"t"}'], ['{"token":1,"expiresAt":9999999999999}'], ['{"token":"","expiresAt":9999999999999}'], ['{"token":"t","expiresAt":"soon"}'], ["null"]])(
    "ignores something that is not a valid session: %s",
    (raw) => {
      sessionStorage.setItem(SESSION_KEY, raw);
      expect(getToken()).toBeNull();
    },
  );

  it("treats blocked storage as no session, never a crash", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getToken()).toBeNull();
    expect(setToken("tok", 60)).toBe(false); // the caller can tell the user their browser refused
    expect(() => clearToken()).not.toThrow();
  });
});

describe("zone preference (localStorage)", () => {
  it("defaults to the site zone", () => {
    expect(getZoneChoice()).toBe("site");
  });

  it.each([
    ["utc", "utc"],
    ["site", "site"],
    ["garbage", "site"],
    ["", "site"],
  ])("reads %j as %s", (stored, expected) => {
    localStorage.setItem(ZONE_KEY, stored);
    expect(getZoneChoice()).toBe(expected);
  });

  it("stores the choice and reads it back", () => {
    setZoneChoice("utc");
    expect(getZoneChoice()).toBe("utc");
    expect(localStorage.getItem(ZONE_KEY)).toBe("utc");
    setZoneChoice("site");
    expect(getZoneChoice()).toBe("site");
  });

  it("survives blocked storage: no crash, and the choice still holds for this page view", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getZoneChoice()).toBe("site");
    expect(() => setZoneChoice("utc")).not.toThrow();
    expect(getZoneChoice()).toBe("utc");
    setZoneChoice("site"); // leave the module as it was for the other tests
  });
});

describe("useZoneChoice", () => {
  it("starts with the stored choice", () => {
    localStorage.setItem(ZONE_KEY, "utc");
    const { result } = renderHook(() => useZoneChoice());
    expect(result.current).toBe("utc");
  });

  it("follows setZoneChoice at once, in every component that uses it (the toggle updates the pages)", () => {
    const a = renderHook(() => useZoneChoice());
    const b = renderHook(() => useZoneChoice());
    expect([a.result.current, b.result.current]).toEqual(["site", "site"]);
    act(() => setZoneChoice("utc"));
    expect([a.result.current, b.result.current]).toEqual(["utc", "utc"]);
  });

  it("follows a change made in another tab", () => {
    const { result } = renderHook(() => useZoneChoice());
    act(() => {
      localStorage.setItem(ZONE_KEY, "utc");
      window.dispatchEvent(new StorageEvent("storage", { key: ZONE_KEY, newValue: "utc" }));
    });
    expect(result.current).toBe("utc");
  });

  it("stops listening when the component goes away", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useZoneChoice());
    unmount();
    expect(remove).toHaveBeenCalledWith("storage", expect.any(Function));
  });
});

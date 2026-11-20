// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The key is read when the module loads, so this file runs with one. There is no real Google script in jsdom:
// the specs play the part of the browser by firing the script's own onerror / callback.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test key&1";
});

import { FallMap } from "./fall-map";
import { loadGoogleMaps, PathMap } from "./path-map";

const scripts = () => [...document.head.querySelectorAll<HTMLScriptElement>("script")];
afterEach(() => {
  scripts().forEach((s) => s.remove());
  vi.restoreAllMocks();
});

describe("loadGoogleMaps", () => {
  it("adds one async script with the URL-encoded key and the ready callback, and fails once the script errors", async () => {
    const promise = loadGoogleMaps("test key&1");
    const [script] = scripts();
    expect(scripts()).toHaveLength(1);
    expect(script.src).toContain("https://maps.googleapis.com/maps/api/js?");
    expect(script.src).toContain("key=test%20key%261");
    expect(script.src).toContain("callback=__onGoogleMapsReady");
    expect(script.async).toBe(true);
    script.onerror!(new Event("error"));
    await expect(promise).rejects.toThrow("load");
  });

  it("allows a retry after a failure, resolves when Google calls back, and then loads only once", async () => {
    const retry = loadGoogleMaps("k");
    expect(scripts()).toHaveLength(1); // a fresh script, the failed one was removed by afterEach
    (window as unknown as Record<string, () => void>).__onGoogleMapsReady();
    await expect(retry).resolves.toBeUndefined();

    await loadGoogleMaps("k");
    expect(scripts()).toHaveLength(1); // the second call reused the first
  });
});

describe("with a key, before Google has loaded", () => {
  it("PathMap shows 'Loading map…' as a status", () => {
    render(<PathMap markers={[{ lat: 1, lon: 1, role: "start", title: "s", lines: [] }]} estimated={false} />);
    expect(screen.getByRole("status").textContent).toBe("Loading map…");
  });

  it("FallMap shows 'Loading map…' as a status", () => {
    render(<FallMap pins={[]} />);
    expect(screen.getByRole("status").textContent).toBe("Loading map…");
  });

  it("PathMap shows the could-not-load message when Google reports a bad key (gm_authFailure)", async () => {
    render(<PathMap markers={[{ lat: 1, lon: 1, role: "start", title: "s", lines: [] }]} estimated={false} />);
    await act(async () => (window as unknown as { gm_authFailure: () => void }).gm_authFailure());
    expect(screen.getByRole("alert").textContent).toContain("The map could not be loaded.");
    expect(screen.getByRole("alert").textContent).not.toContain("no Google Maps key");
  });

  it("FallMap shows the could-not-load message when Google reports a bad key", async () => {
    render(<FallMap pins={[]} />);
    await act(async () => (window as unknown as { gm_authFailure: () => void }).gm_authFailure());
    expect(screen.getByRole("alert").textContent).toContain("The map could not be loaded.");
  });
});

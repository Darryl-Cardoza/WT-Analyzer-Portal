// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// The key is read when the module loads, so this file runs with none.
vi.hoisted(() => {
  delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
});

import { FallMap, type FallPin } from "./fall-map";
import { PathMap, type MapMarker } from "./path-map";

const marker = (role: MapMarker["role"], lat = 38.6): MapMarker => ({ lat, lon: -121.2, role, title: role, lines: [] });
const nest = (name: string | null, address: string | null = null) => ({ name, address, isActive: true, points: [{ lat: 1, lon: 1 }, { lat: 1, lon: 2 }, { lat: 2, lon: 2 }] });
const pin = (over: Partial<FallPin> = {}): FallPin => ({ lat: 38.6, lon: -121.2, title: "This alert", lines: [], color: "#b42323", shape: "circle", current: true, ...over });

describe("PathMap without a Google Maps key", () => {
  it("says the map is not set up and points to the fixes table", () => {
    render(<PathMap markers={[marker("start"), marker("end", 38.7)]} estimated={false} />);
    const msg = screen.getByRole("alert");
    expect(msg.textContent).toContain("The map is not set up (no Google Maps key).");
    expect(msg.textContent).toContain("GPS fixes table below");
  });

  it("offers Straight line / Road route for a path of two or more points, disabled until the map is ready", () => {
    render(<PathMap markers={[marker("start"), marker("end", 38.7)]} estimated={false} />);
    const straight = screen.getByRole("button", { name: "Straight line" }) as HTMLButtonElement;
    const road = screen.getByRole("button", { name: "Road route" }) as HTMLButtonElement;
    expect(straight.disabled).toBe(true);
    expect(road.disabled).toBe(true);
    expect(straight.getAttribute("aria-pressed")).toBe("true");
    expect(road.getAttribute("aria-pressed")).toBe("false");
  });

  it("has no route toggle for a single point (the base does not count)", () => {
    render(<PathMap markers={[marker("start"), marker("base", 38.9)]} estimated={false} />);
    expect(screen.queryByRole("button", { name: "Straight line" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Map options" })).toBeNull();
  });

  it("shows a nest button (singular / plural) only when there are nests", () => {
    const { rerender } = render(<PathMap markers={[marker("start")]} estimated={false} nests={[nest("Home")]} />);
    expect(screen.getByRole("button", { name: "Show nest" })).toBeTruthy();
    rerender(<PathMap markers={[marker("start")]} estimated={false} nests={[nest("Home"), nest(null, "A St")]} />);
    expect(screen.getByRole("button", { name: "Show nests" })).toBeTruthy();
    rerender(<PathMap markers={[marker("start")]} estimated={false} />);
    expect(screen.queryByRole("button", { name: /Show nest/ })).toBeNull();
  });

  it("explains an estimated line in the key", () => {
    render(<PathMap markers={[marker("start"), marker("end", 38.7)]} estimated />);
    expect(screen.getByText(/Dashed line: estimated/)).toBeTruthy();
  });

  it("always shows the map key", () => {
    render(<PathMap markers={[marker("start")]} estimated={false} />);
    const key = screen.getByRole("list", { name: "Map key" });
    expect(key.textContent).toContain("S: last fix before the alert");
    expect(key.textContent).toContain("E: first fix after the alert");
  });
});

describe("FallMap without a Google Maps key", () => {
  it("says the map is not set up", () => {
    render(<FallMap pins={[pin()]} />);
    expect(screen.getByRole("alert").textContent).toBe("The map is not set up (no Google Maps key).");
    expect(screen.getByRole("region", { name: /Map of this fall/ })).toBeTruthy();
  });

  it("shows a nest button only when there are nests, disabled until the map is ready", async () => {
    const { rerender } = render(<FallMap pins={[pin()]} nests={[nest("Home")]} />);
    const button = screen.getByRole("button", { name: "Show nest" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await userEvent.click(button); // does nothing while disabled
    expect(button.getAttribute("aria-pressed")).toBe("false");
    rerender(<FallMap pins={[pin()]} nests={[nest("A"), nest("B")]} />);
    expect(screen.getByRole("button", { name: "Show nests" })).toBeTruthy();
    rerender(<FallMap pins={[pin()]} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("explains the marker shapes and colours", () => {
    render(<FallMap pins={[pin()]} />);
    const key = screen.getByRole("list", { name: "Map key" });
    for (const text of ["Hard fall, true fall", "Soft fall, false positive", "Not acknowledged", "Base", "this alert"]) expect(key.textContent).toContain(text);
  });
});

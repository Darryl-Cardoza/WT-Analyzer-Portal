// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DoorAnalysis, RecentDoor } from "@/lib/alerts";
import { DoorSection } from "./door-analysis";

const TZ = "America/Los_Angeles";
const base: DoorAnalysis = {
  type: "DOOR",
  door: "Back Door",
  resident: "resident51@site.org",
  time: "2026-11-11T21:24:29.970Z",
  falsePositive: "No",
  alertBit: "100000000",
  recentDoors: [],
  doorUsage: [],
};
const recent = (n: number, over: Partial<RecentDoor> = {}): RecentDoor[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `id${i}`,
    startedAt: "2026-11-10T21:00:00Z",
    door: `Door ${i}`,
    falsePositive: "No",
    reason: null,
    acknowledgedAt: null,
    completedAt: null,
    ...over,
  }));
const show = (over: Partial<DoorAnalysis> = {}) => render(<DoorSection analysis={{ ...base, ...over }} timeZone={TZ} />);

describe("DoorSection: this alert", () => {
  it.each([
    ["Yes", "False positive"],
    ["No", "True positive"],
    ["Not Classified", "Not classified"],
  ] as const)("falsePositive %s shows the result %s", (falsePositive, label) => {
    show({ falsePositive });
    expect(screen.getByText("Result").nextElementSibling?.textContent).toBe(label);
  });

  it("lists door, resident and the time in the chosen zone", () => {
    show();
    expect(screen.getByText("Door").nextElementSibling?.textContent).toBe("Back Door");
    expect(screen.getByText("Resident").nextElementSibling?.textContent).toBe("resident51@site.org");
    expect(screen.getByText("Time").nextElementSibling?.textContent).toBe("Nov 11, 1:24 PM");
  });

  it("falls back to dashes for missing values", () => {
    show({ door: null, resident: null, time: null });
    expect(screen.getByText("Door").nextElementSibling?.textContent).toBe("—");
    expect(screen.getByText("Time").nextElementSibling?.textContent).toBe("—");
  });
});

describe("DoorSection: doors used chart", () => {
  const usage = [
    { door: "Back Door", truePositive: 1, other: 5 },
    { door: "Front Door", truePositive: 4, other: 0 },
    { door: "Annex", truePositive: 0, other: 2 },
  ];
  const counts = () => {
    const chart = screen.getByRole("img", { name: "Door alerts per door" });
    return [...chart.children].map((c) => [c.lastElementChild?.textContent, c.firstElementChild?.textContent]);
  };

  it("starts on true positives, in a fixed order by total use (ties by name)", () => {
    show({ doorUsage: usage });
    expect(counts()).toEqual([["Back Door", "1"], ["Front Door", "4"], ["Annex", "0"]]);
  });

  it("toggles to false positive / not classified without reordering the doors", async () => {
    show({ doorUsage: usage });
    const toggle = screen.getByRole("group", { name: "Alert result" });
    await userEvent.click(within(toggle).getByRole("button", { name: "False positive / Not classified" }));
    expect(counts()).toEqual([["Back Door", "5"], ["Front Door", "0"], ["Annex", "2"]]);
    expect(within(toggle).getByRole("button", { name: "False positive / Not classified" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(toggle).getByRole("button", { name: "True positive" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("shows the empty message instead of a chart when there are no doors", () => {
    show({ doorUsage: [] });
    expect(screen.queryByRole("img", { name: "Door alerts per door" })).toBeNull();
    expect(screen.getAllByText(/No other door alerts for this resident/)).toHaveLength(2); // chart card and list card
  });

  it("copes with missing recentDoors and doorUsage", () => {
    show({ recentDoors: undefined, doorUsage: undefined });
    expect(screen.getAllByText(/No other door alerts/)).toHaveLength(2);
    expect(screen.getByText("Total: 0")).toBeTruthy();
  });
});

describe("DoorSection: recent door alerts table", () => {
  it("shows one row per alert with result, reason, response time, completed time and an Open link", () => {
    show({
      recentDoors: [
        { id: "a1", startedAt: "2026-11-10T21:00:00Z", period: "night", door: "Back Door", falsePositive: "Yes", reason: " Door left open ", acknowledgedAt: "2026-11-10T21:02:03Z", completedAt: "2026-11-10T21:10:00Z" },
        { id: "a2", startedAt: "2026-11-09T21:00:00Z", door: null, falsePositive: "Not Classified", reason: null, acknowledgedAt: null, completedAt: null },
      ],
    });
    expect(screen.getByText("Total: 2")).toBeTruthy();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    const first = within(rows[0]).getAllByRole("cell").map((c) => c.textContent);
    expect(first.slice(0, 7)).toEqual(["Nov 10, 1:00 PM", "Night", "Back Door", "False positive", "Door left open", "2m 3s", "Nov 10, 1:10 PM"]);
    expect(within(rows[0]).getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/alert/?id=a1");
    const second = within(rows[1]).getAllByRole("cell").map((c) => c.textContent);
    expect(second.slice(0, 7)).toEqual(["Nov 9, 1:00 PM", "—", "—", "Not classified", "—", "—", "—"]);
  });

  it("has no pager for up to 15 alerts", () => {
    show({ recentDoors: recent(15) });
    expect(screen.queryByRole("navigation", { name: "Door alert pages" })).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(16);
  });

  it("pages 15 at a time and disables Previous / Next at the ends", async () => {
    show({ recentDoors: recent(32) });
    expect(screen.getByText("Total: 32")).toBeTruthy(); // the whole count, not just the 15 on this page
    const nav = () => screen.getByRole("navigation", { name: "Door alert pages" });
    const prev = () => within(nav()).getByRole("button", { name: "Previous" }) as HTMLButtonElement;
    const next = () => within(nav()).getByRole("button", { name: "Next" }) as HTMLButtonElement;

    expect(within(nav()).getByText("Showing 1–15 of 32 alerts")).toBeTruthy();
    expect(within(nav()).getByText("Page 1 of 3")).toBeTruthy();
    expect(prev().disabled).toBe(true);
    expect(next().disabled).toBe(false);

    await userEvent.click(next());
    expect(within(nav()).getByText("Showing 16–30 of 32 alerts")).toBeTruthy();
    expect(screen.getByText("Door 15")).toBeTruthy();
    expect(screen.queryByText("Door 0")).toBeNull();

    await userEvent.click(next());
    expect(within(nav()).getByText("Showing 31–32 of 32 alerts")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2
    expect(next().disabled).toBe(true);

    await userEvent.click(prev());
    expect(within(nav()).getByText("Page 2 of 3")).toBeTruthy();
  });
});

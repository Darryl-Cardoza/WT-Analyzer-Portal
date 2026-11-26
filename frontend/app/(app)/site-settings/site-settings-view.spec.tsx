// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteSettings } from "@/lib/api";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
vi.mock("@/lib/api", async () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }
  class SessionError extends Error {}
  return { ApiError, SessionError, getSiteSettings: vi.fn(), saveSiteSettings: vi.fn(), clearMeCache: vi.fn() };
});
vi.mock("@/lib/use-api", () => ({ useApi: vi.fn() }));

import { ApiError, SessionError, saveSiteSettings } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { SiteSettingsView } from "./site-settings-view";

const none = { softFallProbability: null, hardFallProbability: null };
const base: SiteSettings = {
  site: { id: "1", name: "Eskaton Gold River", timeZone: "America/Los_Angeles" },
  settings: {
    timeDifferenceThreshold: 3,
    batteryThreshold: 8,
    firstPacketDetection: false,
    deviceSwitching: 18,
    acknowledgeWaitTime: null,
    distanceThreshold: 500,
    hdopThreshold: 1.25,
    hdopUpperThreshold: null,
    timeZone: "America/Los_Angeles",
    nightWindow: { startTime: "20:00", endTime: "06:00", isDefault: true },
    showBatteryAlert: true,
    fallProfiles: { high: { softFallProbability: 70, hardFallProbability: 60 }, medium: none, low: none },
  },
};

const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;
const save = () => screen.getByRole("button", { name: /Save changes|Saving/ }) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useApi).mockReturnValue({ data: base, error: null, loading: false });
});

describe("SiteSettingsView", () => {
  it("shows a skeleton while loading", () => {
    vi.mocked(useApi).mockReturnValue({ data: null, error: null, loading: true });
    const { container } = render(<SiteSettingsView />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("throws a load failure to the error page", () => {
    vi.mocked(useApi).mockReturnValue({ data: null, error: new Error("boom"), loading: false });
    expect(() => render(<SiteSettingsView />)).toThrow("boom");
  });

  it("fills the form with this site's settings and notes the default night window", () => {
    render(<SiteSettingsView />);
    expect(field("Distance threshold").value).toBe("500");
    expect(field("HDOP threshold").value).toBe("1.25");
    expect(field("Acknowledge wait time").value).toBe(""); // not set
    expect(screen.getByLabelText("High risk soft fall")).toHaveProperty("value", "70");
    expect(screen.getByText(/default 20:00 – 06:00 applies/)).toBeTruthy();
    expect(save().disabled).toBe(true); // nothing changed yet
  });

  it("sends only what was changed, then shows the saved confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(saveSiteSettings).mockResolvedValue({ ...base, settings: { ...base.settings, distanceThreshold: 600 } });
    render(<SiteSettingsView />);
    await user.clear(field("Distance threshold"));
    await user.type(field("Distance threshold"), "600");
    expect(screen.getByText("1 unsaved change")).toBeTruthy();
    await user.click(save());
    expect(saveSiteSettings).toHaveBeenCalledWith({ distanceThreshold: 600 });
    expect(await screen.findByText("Changes saved successfully.")).toBeTruthy();
    expect(field("Distance threshold").value).toBe("600");
    expect(save().disabled).toBe(true);
  });

  it("blocks saving a value that is not a number, and says why", async () => {
    const user = userEvent.setup();
    render(<SiteSettingsView />);
    await user.clear(field("Battery threshold"));
    await user.type(field("Battery threshold"), "abc");
    expect(screen.getByText("Must be a number")).toBeTruthy();
    expect(save().disabled).toBe(true);
  });

  it("shows the API's message when it refuses a value, and keeps what was typed", async () => {
    const user = userEvent.setup();
    vi.mocked(saveSiteSettings).mockRejectedValue(new ApiError(400, "batteryThreshold must be less than or equal to 100"));
    render(<SiteSettingsView />);
    await user.clear(field("Battery threshold"));
    await user.type(field("Battery threshold"), "150");
    await user.click(save());
    expect((await screen.findByRole("alert")).textContent).toContain("less than or equal to 100");
    expect(field("Battery threshold").value).toBe("150");
  });

  it("goes to the login page when the session has ended", async () => {
    const user = userEvent.setup();
    vi.mocked(saveSiteSettings).mockRejectedValue(new SessionError());
    render(<SiteSettingsView />);
    await user.clear(field("Battery threshold"));
    await user.type(field("Battery threshold"), "9");
    await user.click(save());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?reason=expired"));
  });

  it("Discard puts the saved values back", async () => {
    const user = userEvent.setup();
    render(<SiteSettingsView />);
    await user.clear(field("Distance threshold"));
    await user.type(field("Distance threshold"), "999");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(field("Distance threshold").value).toBe("500");
  });
});

describe("default hints", () => {
  it("shows the defaults dimmed as placeholders: 18000 s for the wait time and threshold + 1 for the HDOP upper threshold", async () => {
    const user = userEvent.setup();
    vi.mocked(useApi).mockReturnValue({ data: base, error: null, loading: false });
    render(<SiteSettingsView />);
    expect(field("Acknowledge wait time").placeholder).toBe("18000");
    expect(screen.getByText("Default: 18000 s (5 hours)")).toBeTruthy();
    expect(field("HDOP upper threshold").placeholder).toBe("2.25"); // HDOP threshold 1.25 + 1
    expect(screen.getByText("Default: 2.25 (HDOP threshold + 1)")).toBeTruthy();
    await user.clear(field("HDOP threshold"));
    await user.type(field("HDOP threshold"), "1.5");
    expect(field("HDOP upper threshold").placeholder).toBe("2.5"); // follows the threshold
  });
});

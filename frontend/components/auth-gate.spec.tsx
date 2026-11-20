// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/session", () => ({ getToken: vi.fn() }));

import { getToken } from "@/lib/session";
import { AuthGate } from "./auth-gate";

beforeEach(() => vi.clearAllMocks());

describe("AuthGate", () => {
  it("shows the page when there is a session", () => {
    vi.mocked(getToken).mockReturnValue("tok");
    render(<AuthGate><p>protected page</p></AuthGate>);
    expect(screen.getByText("protected page")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a visitor without a session to the login page and never shows the page", () => {
    vi.mocked(getToken).mockReturnValue(null);
    render(<AuthGate><p>protected page</p></AuthGate>);
    expect(screen.queryByText("protected page")).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("shows only an empty placeholder while it checks (so the prerendered HTML holds nothing protected)", () => {
    vi.mocked(getToken).mockReturnValue(null);
    const { container } = render(<AuthGate><p>protected page</p></AuthGate>);
    expect(container.textContent).toBe("");
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
  });
});

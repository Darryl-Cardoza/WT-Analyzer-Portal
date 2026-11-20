// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("@/lib/auth", () => ({ login: vi.fn() }));
let query = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query), useRouter: () => ({ replace }) }));

import { login } from "@/lib/auth";
import { LoginForm } from "./login-form";

beforeEach(() => {
  vi.clearAllMocks();
  query = "";
  vi.mocked(login).mockResolvedValue({});
});

const fill = async (id = "admin@site.org", pw = "secret") => {
  await userEvent.type(screen.getByLabelText("User ID"), id);
  await userEvent.type(screen.getByLabelText("Password"), pw);
};

describe("LoginForm", () => {
  it("shows the two fields and the Sign in button, with the password hidden", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("User ID").getAttribute("autocomplete")).toBe("username");
    expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Show / Hide flips the password between hidden and visible", async () => {
    render(<LoginForm />);
    const pw = screen.getByLabelText("Password") as HTMLInputElement;
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(pw.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide password" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(pw.type).toBe("password");
  });

  it("signs in with the typed credentials and goes to the alerts", async () => {
    render(<LoginForm />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(login).toHaveBeenCalledWith("admin@site.org", "secret"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/alerts"));
  });

  it("shows the error as an alert and stays on the page", async () => {
    vi.mocked(login).mockResolvedValue({ error: "Incorrect user ID or password." });
    render(<LoginForm />);
    await fill("a@b.c", "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Incorrect user ID or password.");
    expect(replace).not.toHaveBeenCalled();
  });

  it("disables the button and says 'Signing in…' while the request is running", async () => {
    let finish!: (v: object) => void;
    vi.mocked(login).mockReturnValue(new Promise((r) => (finish = r)));
    render(<LoginForm />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const busy = (await screen.findByRole("button", { name: "Signing in…" })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    finish({ error: "Incorrect user ID or password." });
    await screen.findByRole("button", { name: "Sign in" }); // enabled again after a failed attempt
  });

  it("stays busy after a successful sign-in until the page changes, so it cannot be submitted twice", async () => {
    render(<LoginForm />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/alerts"));
    expect((screen.getByRole("button", { name: "Signing in…" }) as HTMLButtonElement).disabled).toBe(true);
  });

  describe("session-expired notice", () => {
    it("shows for ?reason=expired", () => {
      query = "reason=expired";
      render(<LoginForm />);
      expect(screen.getByRole("status").textContent).toBe("Your session has ended. Please sign in again.");
    });

    it.each(["", "reason=other"])("is absent for %j", (q) => {
      query = q;
      render(<LoginForm />);
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("gives way to a sign-in error", async () => {
      query = "reason=expired";
      vi.mocked(login).mockResolvedValue({ error: "Incorrect user ID or password." });
      render(<LoginForm />);
      await fill();
      await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
      await screen.findByRole("alert");
      expect(screen.queryByRole("status")).toBeNull();
    });
  });
});

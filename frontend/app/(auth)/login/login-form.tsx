"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/lib/auth";

const field =
  "mt-1.5 block w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-soft";

/** The only part that reads the URL, so it alone waits for it; the form itself is in the page shell. */
function ExpiredNotice({ hidden }: { hidden: boolean }) {
  const expired = useSearchParams().get("reason") === "expired";
  if (!expired || hidden) return null;
  return (
    <p role="status" className="rounded-lg bg-brand-faint px-3 py-2 text-sm text-brand-dark">
      Your session has ended. Please sign in again.
    </p>
  );
}

export function LoginForm() {
  const { replace } = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    const result = await login(String(form.get("weartechUserId") ?? ""), String(form.get("password") ?? ""));
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    replace("/alerts"); // stays pending: the page is about to change, and a second submit must not happen
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      <Suspense>
        <ExpiredNotice hidden={!!error} />
      </Suspense>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="weartechUserId" className="text-xs font-semibold">
          User ID
        </label>
        <input
          id="weartechUserId"
          name="weartechUserId"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="admin@your-site.org"
          className={field}
        />
      </div>

      <div>
        <label htmlFor="password" className="text-xs font-semibold">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            className={`${field} pr-16`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-pressed={show}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-brand hover:bg-brand-faint"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

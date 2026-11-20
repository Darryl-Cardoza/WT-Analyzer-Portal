"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/session";

/**
 * Keeps visitors without a session out of the signed-in pages. The check runs in the browser (the session is in
 * sessionStorage), so the prerendered HTML holds only an empty placeholder, never any page content. This only decides
 * where to send people: the API still verifies the token on every call.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { replace } = useRouter();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // The session lives in the browser, so it can only be read after the page has loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (getToken()) setSignedIn(true);
    else replace("/login");
  }, [replace]);

  return signedIn ? children : <div aria-busy="true" className="min-h-screen border-t-4 border-accent" />;
}

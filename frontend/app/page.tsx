"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// A static site has no server-side redirect; the home page just sends visitors on to the alerts
// (which sends them to the login page if they are not signed in).
export default function Home() {
  const { replace } = useRouter();
  useEffect(() => {
    replace("/alerts");
  }, [replace]);
  return null;
}

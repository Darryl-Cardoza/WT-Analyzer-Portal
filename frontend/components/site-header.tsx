"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ZoneToggle } from "@/components/zone-toggle";
import { ME_CHANGED, getMe } from "@/lib/api";
import type { Me } from "@/lib/api";
import { logout } from "@/lib/auth";
import { siteZoneLabel } from "@/lib/timezone";
import { useApi } from "@/lib/use-api";
import { useZoneChoice } from "@/lib/zone-pref";

// useApi needs a module-level loader; the version only exists to load /me again when it changes.
const loadMe = (_version: number) => getMe();

export function SiteHeader() {
  const { replace } = useRouter();
  const [version, setVersion] = useState(0);
  const { data } = useApi(loadMe, version);
  const [lastMe, setLastMe] = useState<Me | null>(null);
  // Site settings tells us when the site's zone changed: load /me again and show the new zone without a page reload.
  useEffect(() => {
    const again = () => setVersion((v) => v + 1);
    window.addEventListener(ME_CHANGED, again);
    return () => window.removeEventListener(ME_CHANGED, again);
  }, []);
  useEffect(() => {
    if (data) setLastMe(data);
  }, [data]);
  const me = data ?? lastMe; // keep showing the old answer while the new one loads, so the header does not flash
  const choice = useZoneChoice();
  if (!me) return <SiteHeaderFallback />; // loading (an ended session is sent to the login page by useApi)

  const siteLabel = siteZoneLabel(me.site.timeZone);
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-4 py-3 md:px-8">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{me.site.name ?? "Your site"}</div>
        <div className="text-[11px] text-muted">
          Times shown in {choice === "utc" ? "UTC" : `${siteLabel} (${me.site.timeZone})`}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <ZoneToggle choice={choice} siteLabel={siteLabel} />
        <span className="hidden max-w-[14rem] truncate text-xs text-muted sm:inline">{me.weartechUserId}</span>
        <button
          type="button"
          onClick={() => {
            logout();
            replace("/login");
          }}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-brand-dark hover:bg-brand-faint"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

export function SiteHeaderFallback() {
  return <div className="h-[57px] border-b border-line bg-white" aria-hidden="true" />;
}

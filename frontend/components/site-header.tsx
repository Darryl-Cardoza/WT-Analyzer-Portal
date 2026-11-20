"use client";

import { useRouter } from "next/navigation";
import { ZoneToggle } from "@/components/zone-toggle";
import { getMe } from "@/lib/api";
import { logout } from "@/lib/auth";
import { siteZoneLabel } from "@/lib/timezone";
import { useApi } from "@/lib/use-api";
import { useZoneChoice } from "@/lib/zone-pref";

export function SiteHeader() {
  const { replace } = useRouter();
  const { data: me } = useApi(getMe);
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

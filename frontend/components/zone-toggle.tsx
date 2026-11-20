"use client";

import { setZoneChoice } from "@/lib/zone-pref";
import type { ZoneChoice } from "@/lib/timezone";

/** Switches every time on the page between UTC and the site's own zone (e.g. PST/PDT). */
export function ZoneToggle({ choice, siteLabel }: { choice: ZoneChoice; siteLabel: string }) {
  const options = [
    ["utc", "UTC"],
    ["site", siteLabel],
  ] as const;
  return (
    <div role="group" aria-label="Time zone" className="flex overflow-hidden rounded-lg border border-line text-[11px] font-medium">
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setZoneChoice(value)}
          aria-pressed={choice === value}
          className={`px-2.5 py-1.5 transition-colors ${choice === value ? "bg-brand-soft text-brand-dark" : "bg-white text-ink/80 hover:bg-brand-faint"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

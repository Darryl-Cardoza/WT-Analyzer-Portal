"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Facts, Stat } from "@/components/detail";
import { detailHref } from "@/lib/alerts";
import type { DoorAnalysis } from "@/lib/alerts";
import { formatDateTime, formatDuration } from "@/lib/format";

const PER_PAGE = 15;

// "True or false" for a door alert is the false-positive flag: Yes = false positive, No = true positive.
const RESULT = {
  Yes: { label: "False positive", tone: "warn" },
  No: { label: "True positive", tone: "ok" },
  "Not Classified": { label: "Not classified", tone: "neutral" },
} as const;

export function DoorSection({ analysis: a, timeZone, month }: { analysis: DoorAnalysis; timeZone: string; month: string }) {
  const result = RESULT[a.falsePositive] ?? RESULT["Not Classified"];
  const recent = a.recentDoors ?? [];
  const [side, setSide] = useState<"truePositive" | "other">("truePositive");
  // Fixed order (most used overall first) so the doors stay put when toggling; zero-count doors keep their slot.
  const usage = [...(a.doorUsage ?? [])]
    .sort((x, y) => y.truePositive + y.other - (x.truePositive + x.other) || x.door.localeCompare(y.door))
    .map((u) => ({ door: u.door, count: u[side] }));
  const maxUse = Math.max(1, ...usage.map((u) => u.count));
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(recent.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = recent.slice(current * PER_PAGE, (current + 1) * PER_PAGE);
  return (
    <>
      <Card title="Door activity">
        <div className="mb-4 max-w-xs">
          <Stat label="Result" value={result.label} tone={result.tone} />
        </div>
        <Facts
          items={[
            ["Door", a.door],
            ["Resident", a.resident],
            ["Time", formatDateTime(a.time, timeZone)],
          ]}
        />
      </Card>

      <Card title={`Doors used in ${month}`}>
        <div className="mb-4 inline-flex rounded-full border border-line bg-white p-0.5 text-xs font-medium" role="group" aria-label="Alert result">
          {([["truePositive", "True positive"], ["other", "False positive / Not classified"]] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={side === k} onClick={() => setSide(k)} className={`rounded-full px-3 py-1 ${side === k ? "bg-brand-faint text-brand-dark" : "text-ink/70 hover:bg-brand-faint"}`}>
              {label}
            </button>
          ))}
        </div>
        {usage.length === 0 ? (
          <p className="text-sm text-muted">No other door alerts for this resident in {month}.</p>
        ) : (
          <div className="flex h-56 items-end gap-3 overflow-x-auto pb-1" role="img" aria-label="Door alerts per door">
            {usage.map((u) => (
              <div key={u.door} className="flex h-full min-w-16 flex-1 flex-col justify-end text-center">
                <span className="mb-1 text-xs font-semibold">{u.count}</span>
                <div className="rounded-t-md bg-brand-dark" style={{ height: `${(u.count / maxUse) * 75}%` }} />
                <span className="mt-2 break-words text-[11px] leading-tight text-muted">{u.door}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title={`Door alerts in ${month}`}
        aside={`Total: ${recent.length}${a.dayNight ? ` · Day: ${a.dayNight.day} · Night: ${a.dayNight.night}` : ""}`}
      >
        {recent.length === 0 ? (
          <p className="text-sm text-muted">No other door alerts for this resident in {month}.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    {["When", "Day / Night", "Door", "Result", "Reason", "Response time", "Completed at", ""].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((d) => (
                    <tr key={d.id} className="border-t border-line">
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDateTime(d.startedAt, timeZone)}</td>
                      <td className="px-3 py-2.5">{d.period === "day" ? "Day" : d.period === "night" ? "Night" : "—"}</td>
                      <td className="px-3 py-2.5">{d.door ?? "—"}</td>
                      <td className="px-3 py-2.5">{(RESULT[d.falsePositive] ?? RESULT["Not Classified"]).label}</td>
                      <td className="px-3 py-2.5">{d.reason?.trim() || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDuration(d.startedAt, d.acknowledgedAt) ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{d.completedAt ? formatDateTime(d.completedAt, timeZone) : "—"}</td>
                      <td className="px-3 py-2.5">
                        <Link href={detailHref(d.id, {})} className="font-medium text-brand-dark hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <nav aria-label="Door alert pages" className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                <span>
                  Showing {current * PER_PAGE + 1}–{current * PER_PAGE + shown.length} of {recent.length} alerts
                </span>
                <span className="flex items-center gap-2">
                  <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-full border border-line bg-white px-3 py-1 font-medium text-ink/80 hover:bg-brand-faint disabled:opacity-50">
                    Previous
                  </button>
                  <span>
                    Page {current + 1} of {pages}
                  </span>
                  <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="rounded-full border border-line bg-white px-3 py-1 font-medium text-ink/80 hover:bg-brand-faint disabled:opacity-50">
                    Next
                  </button>
                </span>
              </nav>
            )}
          </>
        )}
      </Card>
    </>
  );
}

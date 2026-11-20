"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CoordLink, Card, Facts, Note, Stat } from "@/components/detail";
import { FallMap, type FallPin } from "@/components/fall-map";
import { detailHref, fallColor, fallOutcome, humanize, slowTone } from "@/lib/alerts";
import type { FallAnalysis } from "@/lib/alerts";
import { formatDateTime, formatDuration, formatMeters, formatSeconds } from "@/lib/format";

const PACKETS_PER_PAGE = 15;

/** The caption under a slow acknowledgement or completion card (none when it was timely). */
const slowHint = (seconds: number | null | undefined) =>
  slowTone(seconds) === "neutral" ? undefined : `${formatSeconds(seconds!)} after the alert started: ${slowTone(seconds) === "danger" ? "over 4 hours" : "2 to 4 hours"}`;

/** Why there is no verdict, in words the admin can act on. */
function whyNoVerdict(a: FallAnalysis): string {
  if (!a.parsed) return "The alert title is not in the form \"Soft Fall - 90% probability\", so the probability could not be read.";
  if (!a.residentRisk) return "This resident has no fall risk level set.";
  return `The site has no ${a.fallKind} fall threshold for ${a.residentRisk} risk residents.`;
}

export function FallSection({ analysis: a, timeZone }: { analysis: FallAnalysis; timeZone: string }) {
  const kind = a.fallKind ? `${humanize(a.fallKind)} fall` : "Fall";
  const verdictTone = a.meetsThreshold === null ? "neutral" : a.meetsThreshold ? "ok" : "warn";
  const recent = useMemo(() => a.recentFalls ?? [], [a.recentFalls]);
  const [page, setPage] = useState(0);
  const allPackets = a.packets ?? [];
  const pages = Math.max(1, Math.ceil(allPackets.length / PACKETS_PER_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = allPackets.slice(current * PACKETS_PER_PAGE, (current + 1) * PACKETS_PER_PAGE);
  const here = a.alertLocation;
  const pins = useMemo<FallPin[]>(
    () => [
      ...(here
        ? [{
            lat: here.lat,
            lon: here.lon,
            title: "This alert",
            lines: [`${kind}${a.probability === null ? "" : ` - ${a.probability}%`}`, `Outcome: ${fallOutcome(a.isFalsePositive).label}`, `Lat, Long: ${here.lat.toFixed(6)}, ${here.lon.toFixed(6)}`],
            color: fallColor(a.fallKind, a.isFalsePositive),
            shape: a.fallKind === "soft" ? ("diamond" as const) : ("circle" as const),
            current: true,
          }]
        : []),
      ...recent.flatMap((f) =>
        f.location
          ? [{
              lat: f.location.lat,
              lon: f.location.lon,
              title: f.fallKind ? `${humanize(f.fallKind)} fall` : "Fall",
              lines: [
                `Probability: ${f.probability === null ? "—" : `${f.probability}%`}`,
                `Outcome: ${fallOutcome(f.isFalsePositive).label}`,
                `Response time: ${formatDuration(f.startedAt, f.acknowledgedAt) ?? "—"}`,
                ...(f.isFalsePositive && f.reason?.trim() ? [`Reason: ${f.reason.trim()}`] : []),
                `When: ${formatDateTime(f.startedAt, timeZone)}`,
                `Lat, Long: ${f.location.lat.toFixed(6)}, ${f.location.lon.toFixed(6)}`,
              ],
              color: fallColor(f.fallKind, f.isFalsePositive),
              shape: f.fallKind === "soft" ? ("diamond" as const) : ("circle" as const),
            }]
          : [],
      ),
      ...(a.baseLocation
        ? [{ lat: a.baseLocation.lat, lon: a.baseLocation.lon, title: "Base location", lines: [`Lat, Long: ${a.baseLocation.lat.toFixed(6)}, ${a.baseLocation.lon.toFixed(6)}`], color: "#2b2b3a", shape: "circle" as const, base: true }]
        : []),
    ],
    [here, recent, a.baseLocation, a.fallKind, a.probability, a.isFalsePositive, kind, timeZone],
  );

  return (
    <>
      <Card title="Fall analysis">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Type" value={a.fallKind ? humanize(a.fallKind) : "Unknown"} hint={a.parsed ? "From the alert title" : undefined} />
          <Stat label="Probability" value={a.probability === null ? "—" : `${a.probability}%`} />
          <Stat label="Resident risk" value={a.residentRisk ? humanize(a.residentRisk) : "Not set"} />
          <Stat
            label="Site threshold"
            value={a.threshold === null ? "—" : `${a.threshold}%`}
            hint={a.threshold !== null && a.fallKind && a.residentRisk ? `${humanize(a.fallKind)} fall, ${a.residentRisk} risk` : undefined}
          />
        </div>

        <div className="mt-4">
          {a.meetsThreshold === null ? (
            <Note>No verdict: {whyNoVerdict(a)}</Note>
          ) : (
            <Stat
              label="Verdict"
              tone={verdictTone}
              value={a.meetsThreshold ? "Meets threshold" : "Below threshold"}
              hint={`${kind} at ${a.probability}% against the ${a.residentRisk}-risk threshold of ${a.threshold}%`}
            />
          )}
        </div>
      </Card>

      <Card title="Location">
        <Facts
          items={[
            ["Alert location", <CoordLink key="a" coord={a.alertLocation} />],
            ["Base location", <CoordLink key="b" coord={a.baseLocation} />],
            ["Distance from base", formatMeters(a.distanceFromBaseMeters)],
          ]}
        />
        {!a.baseLocation && <p className="mt-3 text-xs text-muted">This resident has no base location set, so no distance can be shown.</p>}
        {!a.alertLocation && <p className="mt-3 text-xs text-muted">The alert carries no GPS position.</p>}
      </Card>

      {a.alertLocation && (
        <Card title="Fall map">
          <FallMap pins={pins} nests={a.nests} />
        </Card>
      )}

      {a.resolution && (
        <Card title="Resolution and sensor data packets">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Resolution time"
              value={a.resolution.completedSeconds == null ? "—" : formatSeconds(a.resolution.completedSeconds)}
              hint={a.resolution.completedAt ? "Alert start to completed at" : "The alert has no completed at time"}
            />
            <Stat label="Acknowledged at" value={a.acknowledgedAt ? formatDateTime(a.acknowledgedAt, timeZone, true) : "—"} tone={slowTone(a.acknowledgedSeconds)} hint={slowHint(a.acknowledgedSeconds)} />
            <Stat label="Resolved at" value={a.resolution.completedAt ? formatDateTime(a.resolution.completedAt, timeZone, true) : "—"} tone={slowTone(a.resolution.completedSeconds)} hint={slowHint(a.resolution.completedSeconds) ?? "Completed at"} />
            <Stat
              label="Time to all-zero packet"
              value={a.resolution.seconds === null ? "—" : formatSeconds(a.resolution.seconds)}
              tone={a.resolution.exceededLimit || a.resolution.status !== "RESOLVED" ? "warn" : "ok"}
              hint={
                a.resolution.exceededLimit
                  ? "Took longer than 3 hours"
                  : a.resolution.status === "RESOLVED"
                    ? `Alert start to the first all-zero alertBit packet, at ${formatDateTime(a.resolution.resolvedAt, timeZone, true)}`
                    : a.resolution.status === "NOT_FOUND"
                      ? "No all-zero packet found yet"
                      : a.resolution.status === "NO_FLAG"
                        ? "No flagged packet at the alert start"
                        : "Sensor data unavailable"
              }
            />
          </div>
          {allPackets.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    {["When", "Packet time", "Since start", "Alert bit", "Source", "Device", "Position"].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p, i) => (
                    <tr key={`${p.packetTimestamp}-${i}`} className={`border-t border-line ${p.acknowledgedDeltaSeconds != null ? "bg-warn/10" : p.category === "BEFORE" ? "bg-page/60 text-muted" : p.category === "RESOLVED" ? "bg-ok/5" : ""}`}>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${p.category === "RESOLVED" ? "border-ok bg-ok/5 text-ok-ink" : p.category === "ALERT" ? "border-brand-dark bg-brand-faint text-brand-dark" : "border-line bg-white"}`}>
                          {p.category === "RESOLVED" ? "After" : p.category}
                        </span>
                        {p.acknowledgedDeltaSeconds != null && (
                          <span
                            className="ml-1.5 rounded-md border border-warn bg-warn/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-warn-ink"
                            title="The packet nearest in time to when the caregiver acknowledged the alert"
                          >
                            Acknowledged {p.acknowledgedDeltaSeconds === 0 ? "" : `(packet ${formatSeconds(Math.abs(p.acknowledgedDeltaSeconds))} ${p.acknowledgedDeltaSeconds < 0 ? "before" : "after"})`}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDateTime(p.packetTimestamp, timeZone, true)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{p.offsetSeconds < 0 ? `−${formatSeconds(-p.offsetSeconds)}` : formatSeconds(p.offsetSeconds)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono">{p.alertBit ?? "—"}</td>
                      <td className="px-3 py-2.5">{p.payloadType ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono">{p.deviceId ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <CoordLink coord={p.latitude !== null && p.longitude !== null ? { lat: p.latitude, lon: p.longitude } : null} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pages > 1 && (
                <nav aria-label="Packet pages" className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                  <span>
                    Showing {current * PACKETS_PER_PAGE + 1}–{current * PACKETS_PER_PAGE + shown.length} of {allPackets.length} packets
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
            </div>
          )}
          {a.notes && a.notes.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {a.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card title="Falls in the last 30 days" aside={`Total: ${recent.length}`}>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">No other falls for this resident in the 30 days up to this alert.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    {["When", "Type", "Probability", "Outcome", "Reason", "Response time", "Completed at", ""].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((f) => (
                    <tr key={f.id} className="border-t border-line">
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDateTime(f.startedAt, timeZone)}</td>
                      <td className="px-3 py-2.5">{f.fallKind ? humanize(f.fallKind) : "Unknown"}</td>
                      <td className="px-3 py-2.5">{f.probability === null ? "—" : `${f.probability}%`}</td>
                      <td className="px-3 py-2.5">{fallOutcome(f.isFalsePositive).label}</td>
                      <td className="px-3 py-2.5">{f.isFalsePositive ? f.reason?.trim() || "—" : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDuration(f.startedAt, f.acknowledgedAt) ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{f.completedAt ? formatDateTime(f.completedAt, timeZone) : "—"}</td>
                      <td className="px-3 py-2.5">
                        <Link href={detailHref(f.id, {})} className="font-medium text-brand-dark hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {recent.some((f) => !f.location) && <p className="mt-3 text-xs text-muted">Falls without a GPS position are listed but not plotted on the map.</p>}
          </>
        )}
      </Card>
    </>
  );
}

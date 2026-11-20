import { Card, CoordLink, Facts, Stat } from "@/components/detail";
import { PathMap, type MapMarker } from "@/components/path-map";
import { hdopSignal, type GeofenceAnalysis, type GpsFix } from "@/lib/alerts";
import { formatAge, formatDateTime, formatMeters, formatOffset } from "@/lib/format";
import { buildPath } from "@/lib/path";

const dash = <span className="text-muted">—</span>;
const orDash = (value: number | null) => (value === null ? dash : value);

export function GeofenceSection({ analysis: a, timeZone }: { analysis: GeofenceAnalysis; timeZone: string }) {
  const source = a.alertSource;
  const trigger = source.trigger;
  const signal = hdopSignal(a.alertHdop);
  const averageHdop =
    a.averageHdop === null
      ? "No HDOP readings"
      : `${a.averageHdop} (${a.fixesWithHdop} reading${a.fixesWithHdop === 1 ? "" : "s"}${
          a.hdopAboveThreshold === null ? "" : a.hdopAboveThreshold ? ", above the site limit (less precise)" : ", within the site limit"
        })`;

  const path = buildPath(a.gpsFixes);
  const label = { start: "Last fix before the alert", mid: "Fix during the alert", end: "First fix after the alert" } as const;
  const markers: MapMarker[] = [
    ...path.points.map((p): MapMarker => ({
      lat: p.lat,
      lon: p.lon,
      role: p.role,
      title: label[p.role],
      // Shown when the point is hovered (or tapped): the same readings as the GPS fixes table.
      lines: [
        `Lat, Long: ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`,
        `HDOP: ${p.fix.hdop ?? "—"}`,
        `Fix quality: ${p.fix.fixQuality ?? "—"}`,
        `Satellites: ${p.fix.satellites ?? "—"}`,
        `Location timestamp: ${p.fix.gpsTimestamp ? formatDateTime(p.fix.gpsTimestamp, timeZone, true) : "—"}`,
      ],
    })),
    ...(a.baseLocation
      ? [{ lat: a.baseLocation.lat, lon: a.baseLocation.lon, role: "base" as const, title: "Base location", lines: [`Lat, Long: ${a.baseLocation.lat.toFixed(6)}, ${a.baseLocation.lon.toFixed(6)}`] }]
      : []),
  ];

  return (
    <>
      <Card title="Movement analysis">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Alert source"
            value={source.source}
            hint={source.source === "Unknown" ? source.reason : source.confidence}
          />
          <Stat
            label="Fresh GPS fixes"
            value={a.freshGpsFixes}
            hint={a.freshGpsFixes > 0 ? `${a.fixesWithCoordinates} with usable coordinates` : "None during the alert"}
          />
          <Stat label="HDOP at alert" value={a.alertHdop ?? "—"} tone={signal.tone} hint={signal.label} />
          <Stat label="Distance travelled" value={formatMeters(a.distanceTravelledMeters)} hint={a.gpsCoverage} />
        </div>

        <div className="mt-5">
          <Facts
            items={[
              ...(trigger
                ? ([
                    ["Triggering packet", `${formatDateTime(trigger.packetTimestamp, timeZone, true)} · ${formatOffset(trigger.offsetSeconds)}`],
                    ["Packet type", trigger.rawPayloadType || "—"],
                  ] as Array<[string, string]>)
                : []),
              ["Average HDOP", averageHdop],
              ...(trigger ? ([["Why this source", source.reason]] as Array<[string, string]>) : []),
            ]}
          />
        </div>
      </Card>

      <Card title="Location">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Distance from base"
            value={formatMeters(a.distanceFromBaseMeters)}
            tone={a.beyondDistanceThreshold ? "warn" : "neutral"}
            hint={
              a.beyondDistanceThreshold === null
                ? undefined
                : a.beyondDistanceThreshold
                  ? "Beyond the site distance threshold"
                  : "Within the site distance threshold"
            }
          />
        </div>
        <div className="mt-5">
          <Facts
            items={[
              ["Alert location", <CoordLink key="a" coord={a.alertLocation} />],
              ["Base location", <CoordLink key="b" coord={a.baseLocation} />],
            ]}
          />
        </div>
      </Card>

      <Card title="Path during the alert">
        {path.points.length === 0 ? (
          <p className="text-sm text-muted">No GPS fixes to plot for this alert.</p>
        ) : (
          <PathMap nests={a.nests} markers={markers} estimated={path.estimated} />
        )}
        {/* Notes can be warnings (e.g. the sensor lookup failed), so they show even when there is nothing to plot. */}
        {a.notes.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {a.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="GPS fixes">
        {a.gpsFixes.length === 0 ? (
          <p className="text-sm text-muted">No GPS fixes were found around this alert.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[68rem] text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    {["When", "Packet time", "Position", "HDOP", "Satellites", "Fix quality", "Alert bit", "Device", "GPS age", "Packets", "Segment", "Total"].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {a.gpsFixes.map((f, i) => (
                    <FixRow key={`${f.gpsTimestamp}-${i}`} fix={f} timeZone={timeZone} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">
              “During” fixes lie inside the alert and make up the measured path. “Before” and “After” are the packets immediately
              either side of it, shown for context. “Packets” is how many packets carried the same GPS fix (a device repeats its
              last fix until it gets a new one); for “During” only those inside the alert window are counted.
            </p>
          </>
        )}
      </Card>

      {a.sensorDocumentIds.length > 0 && (
        <details className="rounded-xl border border-line bg-white px-5 py-3 text-sm">
          <summary className="cursor-pointer font-semibold">Sensor document IDs ({a.sensorDocumentIds.length})</summary>
          <ul className="mt-3 space-y-1 font-mono text-xs">
            {a.sensorDocumentIds.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function FixRow({ fix: f, timeZone }: { fix: GpsFix; timeZone: string }) {
  const context = f.category !== "DURING";
  return (
    <tr className={`border-t border-line ${context ? "bg-page/60 text-muted" : ""}`}>
      <td className="px-3 py-2.5">
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${context ? "border-line bg-white" : "border-brand-dark bg-brand-faint text-brand-dark"}`}>
          {f.category}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">{formatDateTime(f.packetTimestamp, timeZone, true)}</td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <CoordLink coord={{ lat: f.latitude, lon: f.longitude }} />
      </td>
      <td className="px-3 py-2.5">{orDash(f.hdop)}</td>
      <td className="px-3 py-2.5">{orDash(f.satellites)}</td>
      <td className="px-3 py-2.5">{orDash(f.fixQuality)}</td>
      <td className="whitespace-nowrap px-3 py-2.5 font-mono">{f.alertBit ?? dash}</td>
      <td className="whitespace-nowrap px-3 py-2.5 font-mono">{f.deviceId ?? dash}</td>
      <td className="whitespace-nowrap px-3 py-2.5">{formatAge(f.gpsAgeMinutes)}</td>
      <td className="px-3 py-2.5">{f.packetCount ?? dash}</td>
      <td className="whitespace-nowrap px-3 py-2.5">{f.segmentDistanceMeters === null ? dash : formatMeters(f.segmentDistanceMeters)}</td>
      <td className="whitespace-nowrap px-3 py-2.5">{f.cumulativeDistanceMeters === null ? dash : formatMeters(f.cumulativeDistanceMeters)}</td>
    </tr>
  );
}

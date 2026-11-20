"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FalsePositiveBadge, StatusBadge, TypeTag } from "@/components/badges";
import { Card, Facts, Note } from "@/components/detail";
import { DoorSection } from "@/components/door-analysis";
import { FallSection } from "@/components/fall-analysis";
import { GeofenceSection } from "@/components/geofence-analysis";
import { NotFoundPanel } from "@/components/not-found-panel";
import { ApiError, getAlert } from "@/lib/api";
import { backHref, param } from "@/lib/alerts";
import { formatDateTime, formatDuration } from "@/lib/format";
import { displayZone } from "@/lib/timezone";
import { useApi } from "@/lib/use-api";
import { useZoneChoice } from "@/lib/zone-pref";

/** No id is the same as an unknown one: not found. */
const loadAlert = (id: string | undefined) => (id ? getAlert(id) : Promise.reject(new ApiError(404, "No alert id")));

// One static page for every alert: the id is in the URL (?id=...). It reads the URL, so the page wraps it in <Suspense>.
export function AlertDetailView() {
  const sp = useSearchParams();
  const id = param(sp, "id");
  const from = param(sp, "from");

  const { data, error, loading } = useApi(loadAlert, id);
  const choice = useZoneChoice();

  if (loading) return <AlertDetailSkeleton />;
  if (error) {
    // Unknown id, malformed id, or an alert from another site: all look the same. Anything else goes to the error page.
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return <NotFoundPanel />;
    throw error;
  }
  if (!data) return <AlertDetailSkeleton />;

  const { alert, resident, analysis } = data;
  const timeZone = displayZone(choice, data.timeZone);
  const duration = formatDuration(alert.startedAt, alert.endedAt);
  const ack = alert.acknowledgment;

  return (
    <>
      <Link href={backHref(from)} className="text-sm font-medium text-brand-dark hover:underline">
        ← Back to results
      </Link>

      <header className="mt-4 rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <TypeTag type={alert.alertType} />
          <StatusBadge status={alert.alertStatus} />
          {alert.isFalsePositive !== null && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              False positive <FalsePositiveBadge value={alert.isFalsePositive} />
            </span>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-bold">{alert.alertTitle || "Alert"}</h1>
        <div className="mt-4">
          <Facts
            items={[
              [
                "Resident",
                resident.name ? (
                  <span key="r">
                    {resident.name}
                    <span className="block text-xs text-muted">{alert.resident}</span>
                  </span>
                ) : (
                  alert.resident
                ),
              ],
              ["Started", formatDateTime(alert.startedAt, timeZone)],
              ["Ended", alert.endedAt ? `${formatDateTime(alert.endedAt, timeZone)}${duration ? ` (${duration})` : ""}` : "—"],
              ["Device", alert.deviceId ?? resident.deviceId],
              ["Alert ID", <span key="id" className="font-mono text-xs">{alert.id}</span>],
            ]}
          />
        </div>
      </header>

      <div className="mt-5 space-y-5">
        {analysis?.type === "FALL" && <FallSection analysis={analysis} timeZone={timeZone} />}
        {analysis?.type === "DOOR" && <DoorSection analysis={analysis} timeZone={timeZone} />}
        {analysis?.type === "GEOFENCE" && <GeofenceSection analysis={analysis} timeZone={timeZone} />}
        {!analysis && (
          <Card title="Analysis">
            <Note>No detailed analysis is available for this alert type.</Note>
          </Card>
        )}

        <Card title="Acknowledgement">
          <Facts
            items={[
              ["Acknowledged", ack.acknowledged === null ? "—" : ack.acknowledged ? "Yes" : "No"],
              ["Acknowledged at", formatDateTime(ack.acknowledgedAt, timeZone)],
              ["Acknowledged / closed by", ack.acknowledgedBy ?? "—"],
              ["Completed at", formatDateTime(ack.completedAt, timeZone)],
              ["Notes", ack.notes?.trim() ? ack.notes : "—"],
            ]}
          />
        </Card>
      </div>
    </>
  );
}

export function AlertDetailSkeleton() {
  return (
    <div aria-busy="true" className="space-y-5 motion-safe:animate-pulse">
      <div className="h-5 w-36 rounded bg-white" />
      <div className="h-44 rounded-xl bg-white" />
      <div className="h-56 rounded-xl bg-white" />
    </div>
  );
}

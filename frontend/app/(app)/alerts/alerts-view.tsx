"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChipRow } from "@/components/chip-row";
import { FalsePositiveBadge, StatusBadge, TypeTag } from "@/components/badges";
import { ApiError, getMe, searchAlerts } from "@/lib/api";
import type { Me } from "@/lib/api";
import {
  TYPE_FILTERS,
  alertsHref,
  applyFilters,
  paginate,
  detailHref,
  falsePositiveOptions,
  humanize,
  param,
  searchRange,
  SOURCES,
  sourceOptions,
  statusOptions,
  toggleType,
  toggleValue,
  typeList,
  validFp,
  validSource,
  validType,
} from "@/lib/alerts";
import type { Filters } from "@/lib/alerts";
import { formatDateTime, formatDay, todayIn } from "@/lib/format";
import { displayZone, siteZoneLabel } from "@/lib/timezone";
import { useApi } from "@/lib/use-api";
import { useZoneChoice } from "@/lib/zone-pref";

const input =
  "mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft";

type SearchKey = { email?: string; date: string; time?: string; toDate?: string; toTime?: string; tz: string };

/** Runs the search a key stands for: a to-date makes it a range, otherwise it is one day. Times are read in `tz`. */
function searchByKey(key: string) {
  const q: SearchKey = JSON.parse(key);
  const range = searchRange(q);
  return searchAlerts(range ? { email: q.email, tz: q.tz, ...range } : { email: q.email, date: q.date, time: q.time, tz: q.tz });
}

// Reads the URL (so the page wraps it in <Suspense>) and loads in the browser: first the site (for its time zone), then the search.
// A failure other than a bad date or time is thrown, so the app's error page shows it.
export function AlertsView() {
  const { data: me, error } = useApi(getMe);
  if (error) throw error;
  if (!me) return <AlertsSkeleton />;
  return <AlertsResults me={me} />;
}

function AlertsResults({ me }: { me: Me }) {
  const sp = useSearchParams();
  const choice = useZoneChoice();
  const zone = displayZone(choice, me.site.timeZone); // the zone the search is read in and the results are shown in
  const email = param(sp, "email");
  const date = param(sp, "date") ?? todayIn(zone); // default: today in that zone
  const time = param(sp, "time");
  const toDate = param(sp, "toDate");
  const toTime = param(sp, "toTime");
  const search = { email, date, time, toDate, toTime };
  const range = searchRange({ date, time, toDate, toTime });
  const type = validType(param(sp, "type"));
  const status = param(sp, "status");
  const source = validSource(param(sp, "source"));
  const fp = validFp(param(sp, "fp"));
  const page = param(sp, "page"); // every URL parameter is read here, before anything is derived from them

  // A new search (or a new zone) is a new key, and a new key is a new request.
  const key = JSON.stringify({ email, date, time, toDate, toTime, tz: zone });
  const { data: result, error, loading } = useApi(searchByKey, key);

  if (loading) return <AlertsSkeleton />;
  // A bad date or time is the admin's to fix; anything else goes to the error page.
  if (error && !(error instanceof ApiError && error.status === 400)) throw error;
  const problem = error?.message ?? null;

  const all = result?.alerts ?? [];
  const shown = applyFilters(all, { type, status, source, fp });
  const pg = paginate(shown, page);
  const href = (over: Partial<Filters>) => alertsHref({ ...search, type, status, source, fp, ...over });
  const pageHref = (n: number) => href({ page: n > 1 ? String(n) : undefined });
  const pagerLink = "rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-brand-faint/60";

  return (
    <>
      <form action="/alerts/" className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] sm:items-end">
        {/* Keep the active filters when the search is submitted. */}
        {Object.entries({ type, status, source, fp }).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        <label className="text-xs font-semibold">
          Resident email
          <input name="email" type="text" defaultValue={search.email} placeholder="resident9@your-site.org" autoCapitalize="none" spellCheck={false} className={input} />
        </label>
        <label className="text-xs font-semibold">
          From date
          <input name="date" type="date" defaultValue={search.date} className={input} />
        </label>
        <label className="text-xs font-semibold">
          From time <span className="font-normal text-muted">(optional)</span>
          <input name="time" type="time" defaultValue={search.time} className={input} />
        </label>
        <label className="text-xs font-semibold">
          To date <span className="font-normal text-muted">(optional)</span>
          <input name="toDate" type="date" defaultValue={search.toDate} className={input} />
        </label>
        <label className="text-xs font-semibold">
          To time <span className="font-normal text-muted">(optional)</span>
          <input name="toTime" type="time" defaultValue={search.toTime} className={input} />
        </label>
        <button type="submit" className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          Search
        </button>
      </form>

      <p className="mt-2 text-xs text-muted">Search times and results are in {zone === "UTC" ? "UTC" : siteZoneLabel(zone)}.</p>

      {problem && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-bad">
          {problem}
        </p>
      )}

      {result && (
        <>
          <p className="mt-5 text-sm text-muted">
            Total <span className="font-semibold text-ink">{all.length}</span> alert{all.length === 1 ? "" : "s"} {range ? "from" : "on"}{" "}
            {range
              ? `${formatDay(search.date)}${search.time ? ` ${search.time}` : ""} to ${formatDay(search.toDate!)}${search.toTime ? ` ${search.toTime}` : ""}`
              : `${formatDay(search.date)}${search.time ? ` around ${search.time}` : ""}`}
            {search.email ? ` for ${search.email}` : ""}
          </p>

          {all.length > 0 && (
            <div className="mt-3 flex gap-3 text-sm">
              {/* Counted from the filtered list, so they follow the Type / Status / ... chips. */}
              <span className="rounded-lg border border-line bg-white px-3 py-1.5">
                Day <span className="ml-1 font-semibold text-ink">{shown.filter((a) => a.period === "day").length}</span>
              </span>
              <span className="rounded-lg border border-line bg-white px-3 py-1.5">
                Night <span className="ml-1 font-semibold text-ink">{shown.filter((a) => a.period === "night").length}</span>
              </span>
            </div>
          )}

          {all.length > 0 && (
            <div className="mt-4 space-y-3">
              <ChipRow
                label="Type"
                chips={[
                  { label: "All Types", href: href({ type: undefined }), active: !type },
                  // Several types can be on at once: a click adds or removes that type.
                  ...TYPE_FILTERS.map((f) => ({ label: f.label, href: href({ type: toggleType(type, f.value) }), active: typeList(type).includes(f.value) })),
                ]}
              />
              <ChipRow
                label="Status"
                chips={[
                  { label: "All", href: href({ status: undefined }), active: !status },
                  ...statusOptions(all).map((s) => ({ label: humanize(s), href: href({ status: toggleValue(status, s) }), active: typeList(status).includes(s), disabled: !all.some((a) => a.alertStatus === s) })),
                ]}
              />
              {/* Only Nest alerts have a source, so this row appears only when the result has some. */}
              {all.some((a) => a.alertType === "GEOFENCE") && (
                <ChipRow
                  label="Source"
                  chips={[
                    { label: "All", href: href({ source: undefined }), active: !source },
                    ...SOURCES.filter((s) => s !== "Unknown" || sourceOptions(all).includes(s)).map((s) => ({ label: s, href: href({ source: toggleValue(source, s) }), active: typeList(source).includes(s), disabled: !sourceOptions(all).includes(s) })),
                  ]}
                />
              )}
              <ChipRow
                label="False Positive"
                chips={[
                  { label: "All", href: href({ fp: undefined }), active: !fp },
                  ...falsePositiveOptions(all).map((f) => ({ label: f.label, href: href({ fp: toggleValue(fp, f.key) }), active: typeList(fp).includes(f.key), disabled: !f.present })),
                ]}
              />
            </div>
          )}

          <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-white">
            <div className="border-b border-line px-4 py-3 text-sm font-semibold">
              Filtered ({shown.length} of {all.length})
              {pg.totalPages > 1 && (
                <span className="ml-2 font-normal text-muted">
                  · showing {pg.start + 1}–{pg.start + pg.items.length}
                </span>
              )}
            </div>
            {shown.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">
                {all.length === 0 ? "No alerts match this search." : "No alerts match these filters."}
              </p>
            ) : (
              <table className="w-full min-w-[48rem] text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    {["Type", "Status", "Source", "Resident", "Created", "Summary", "False Positive"].map((h) => (
                      <th key={h} scope="col" className="px-4 py-2.5 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pg.items.map((a) => (
                    // The summary link stretches over the whole row (after:inset-0), so a click anywhere opens the alert,
                    // and keyboard and screen-reader users still get one ordinary link per row.
                    <tr key={a.id} className="relative cursor-pointer border-t border-line hover:bg-brand-faint/60 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-brand-dark">
                      <td className="px-4 py-3"><TypeTag type={a.alertType} /></td>
                      <td className="px-4 py-3"><StatusBadge status={a.alertStatus} /></td>
                      <td className="px-4 py-3">{a.source ?? <span className="text-muted">—</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {a.residentName ? (
                          <>
                            <div className="font-medium">{a.residentName}</div>
                            <div className="text-muted">{a.resident}</div>
                          </>
                        ) : (
                          a.resident
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDateTime(a.startedAt, zone)}</td>
                      <td className="px-4 py-3">
                        <Link href={detailHref(a.id, { ...search, type, status, source, fp, page: pg.page > 1 ? String(pg.page) : undefined })} className="font-medium text-brand-dark underline-offset-2 outline-none after:absolute after:inset-0 hover:underline">
                          {a.alertTitle || "Open alert"}
                        </Link>
                      </td>
                      <td className="px-4 py-3"><FalsePositiveBadge value={a.isFalsePositive} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {pg.totalPages > 1 && (
              <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-4 py-3 text-xs">
                {pg.page > 1 ? <Link href={pageHref(pg.page - 1)} className={pagerLink}>Previous</Link> : <span />}
                <span className="text-muted">Page {pg.page} of {pg.totalPages}</span>
                {pg.page < pg.totalPages ? <Link href={pageHref(pg.page + 1)} className={pagerLink}>Next</Link> : <span />}
              </nav>
            )}
          </div>
        </>
      )}
    </>
  );
}

export function AlertsSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4 motion-safe:animate-pulse">
      <div className="h-[84px] rounded-xl bg-white" />
      <div className="h-64 rounded-xl bg-white" />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/detail";
import { ApiError, clearMeCache, getSiteSettings, saveSiteSettings, SessionError } from "@/lib/api";
import type { SiteSettings } from "@/lib/api";
import { NUMBER_FIELDS, RISKS, clockText, diffForm, durationText, nightBar, toForm, zoneChoices } from "@/lib/site-settings";
import type { Form } from "@/lib/site-settings";
import { siteZoneLabel } from "@/lib/timezone";
import { useApi } from "@/lib/use-api";

const control =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal text-ink outline-none transition-colors placeholder:text-muted/60 hover:border-brand/40 focus:border-brand focus:ring-2 focus:ring-brand-soft aria-[invalid=true]:border-bad";
const labelText = "text-xs font-semibold text-ink";

// Loads in the browser like the other pages: the site comes from the signed-in admin's token, so each admin sees only their own site.
export function SiteSettingsView() {
  const { data, error } = useApi(getSiteSettings);
  if (error) throw error;
  if (!data) return <SiteSettingsSkeleton />;
  return <SettingsForm initial={data} />;
}

function SettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial); // what the server has now
  const [form, setForm] = useState<Form>(() => toForm(initial.settings));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { changes, errors } = diffForm(form, saved.settings);
  const changeCount = Object.keys(changes).length;
  // The backend falls back to the HDOP threshold + 1 (threshold itself defaults to 1.25) when no upper threshold is set.
  const lowerHdop = Number(form.hdopThreshold);
  const upperDefault = Math.round(((form.hdopThreshold?.trim() && Number.isFinite(lowerHdop) ? lowerHdop : 1.25) + 1) * 1000) / 1000;
  const blocked = Object.keys(errors).length > 0;
  const set = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDone(false);
    setProblem(null);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!changeCount || blocked || saving) return;
    setSaving(true);
    setProblem(null);
    try {
      const next = await saveSiteSettings(changes);
      setSaved(next);
      setForm(toForm(next.settings));
      setDone(true);
      if (changes.timeZone) clearMeCache(); // the header (and the next page you open) must read the site's new zone: no page reload needed
    } catch (err) {
      if (err instanceof SessionError) router.replace("/login?reason=expired");
      else if (err instanceof ApiError) setProblem(err.message);
      else setProblem("Cannot reach the server. Please try again shortly.");
    } finally {
      setSaving(false);
    }
  }

  const reset = () => {
    setForm(toForm(saved.settings));
    setProblem(null);
    setDone(false);
  };

  // A number input with its unit inside the box and an optional hint underneath.
  const number = (key: string, label: string, unit = "", hint = "", placeholder = "") => (
    <div key={key}>
      <label htmlFor={`f-${key}`} className={labelText}>
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={`f-${key}`}
          value={form[key] ?? ""}
          onChange={(e) => set(key, e.target.value)}
          inputMode="decimal"
          placeholder={placeholder}
          aria-invalid={errors[key] ? true : undefined}
          className={`${control} ${unit ? "pr-10" : ""} tabular-nums`}
        />
        {unit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">{unit}</span>}
      </div>
      {errors[key] ? <p className="mt-1 text-xs text-bad">{errors[key]}</p> : hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );


  return (
    <form onSubmit={save} className="space-y-5 pb-24" noValidate>
      <Card title="Time zone" aside={saved.site.name ?? undefined}>
        <TimeZoneSelect value={form.timeZone ?? ""} onChange={(v) => set("timeZone", v)} error={errors.timeZone} />
      </Card>

      <NightWindowCard start={form.nightStart ?? ""} end={form.nightEnd ?? ""} onStart={(v) => set("nightStart", v)} onEnd={(v) => set("nightEnd", v)} error={errors.nightStart} isDefault={saved.settings.nightWindow.isDefault} />

      <Card title="Location and GPS">
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {NUMBER_FIELDS.filter((f) => f.group === "gps").map((f) => (f.key === "hdopUpperThreshold" ? number(f.key, f.label, f.unit, `Default: ${upperDefault} (HDOP threshold + 1)`, String(upperDefault)) : number(f.key, f.label, f.unit)))}
        </div>
      </Card>

      <Card title="Alerts and battery">
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {NUMBER_FIELDS.filter((f) => f.group === "alerts" && f.key !== "acknowledgeWaitTime").map((f) => number(f.key, f.label, f.unit))}
          {number("acknowledgeWaitTime", "Acknowledge wait time", "s", "Default: 18000 s (5 hours)", "18000")}
        </div>
      </Card>

      <Card title="Fall detection thresholds" aside="Minimum probability that raises a fall alert">
        <div className="grid grid-cols-[6.5rem_1fr_1fr] items-center gap-x-4 gap-y-3 sm:grid-cols-[9rem_1fr_1fr]">
          <span />
          <span className="text-xs font-semibold text-muted">Soft fall</span>
          <span className="text-xs font-semibold text-muted">Hard fall</span>
          {RISKS.map((r) => (
            <FallRow key={r.key} label={r.label} risk={r.key} form={form} errors={errors} set={set} />
          ))}
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur md:left-56">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3 md:px-8">
          <button
            type="submit"
            disabled={!changeCount || blocked || saving}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={reset} disabled={!changeCount || saving} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-brand-faint disabled:cursor-not-allowed disabled:opacity-40">
            Discard
          </button>
          <span aria-live="polite" className="text-sm">
            {problem ? (
              <span role="alert" className="text-bad">
                {problem}
              </span>
            ) : done ? (
              <span className="text-ok-ink">Changes saved successfully.</span>
            ) : changeCount ? (
              <span className="text-muted">
                {changeCount} unsaved change{changeCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </form>
  );
}

function FallRow({ label, risk, form, errors, set }: { label: string; risk: string; form: Form; errors: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <>
      <span className="text-sm font-medium">{label}</span>
      {(["soft", "hard"] as const).map((kind) => {
        const key = `${risk}.${kind}`;
        return (
          <div key={kind}>
            <div className="relative">
              <input
                aria-label={`${label} ${kind} fall`}
                value={form[key] ?? ""}
                onChange={(e) => set(key, e.target.value)}
                inputMode="decimal"
                aria-invalid={errors[key] ? true : undefined}
                className={`${control} pr-8 tabular-nums`}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">%</span>
            </div>
            {errors[key] && <p className="mt-1 text-xs text-bad">{errors[key]}</p>}
          </div>
        );
      })}
    </>
  );
}

/** A dropdown of time zones grouped by region, each with its short name (PST/PDT). A site on a zone not listed keeps it as an extra entry. */
function TimeZoneSelect({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const groups = useMemo(() => zoneChoices(value), [value]);
  return (
    <div className="max-w-xl">
      <label htmlFor="f-timeZone" className={labelText}>
        Site time zone
      </label>
      <select id="f-timeZone" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} className={`${control} mt-1.5`}>
        {!value && <option value="">Select a time zone</option>}
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name ? `${z.name} — ${z.id} (${siteZoneLabel(z.id)})` : `${z.id} (${siteZoneLabel(z.id)})`}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-bad">{error}</p> : <p className="mt-1 text-xs text-muted">Alert times and the day / night split are shown in this zone.</p>}
    </div>
  );
}

const TICKS = [
  { at: 0, label: "12 AM" },
  { at: 25, label: "6 AM" },
  { at: 50, label: "12 PM" },
  { at: 75, label: "6 PM" },
  { at: 100, label: "12 AM" },
];

/** The night window as its own card: start / end pickers and a 24 hour bar that shows where night falls. */
function NightWindowCard({ start, end, onStart, onEnd, error, isDefault }: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void; error?: string; isDefault: boolean }) {
  const bar = nightBar(start, end);
  return (
    <Card title="Night window" aside={bar ? `${clockText(start)} → ${clockText(end)} · ${durationText(bar.totalMinutes)}` : undefined}>
      <p className="mb-4 text-sm text-muted">Alerts that start inside this window count as night on the Alerts page. Everything else is day.</p>

      <div role="img" aria-label={bar ? `Night from ${clockText(start)} to ${clockText(end)}` : "Night window"}>
        <div className="relative h-4 overflow-hidden rounded-full border border-line bg-brand-faint">
          {bar?.ranges.map(([from, to]) => (
            <div key={from} className="absolute inset-y-0 bg-brand-dark" style={{ left: `${(from / 1440) * 100}%`, width: `${((to - from) / 1440) * 100}%` }} />
          ))}
        </div>
        <div className="relative mt-1.5 h-4 text-[11px] text-muted">
          {TICKS.map((t) => (
            <span key={t.at} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${t.at}%` }}>
              {t.label}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-full bg-brand-dark" /> Night
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-full border border-line bg-brand-faint" /> Day
          </span>
        </div>
      </div>

      <div className="mt-5 grid max-w-md grid-cols-2 gap-4">
        <div>
          <label htmlFor="f-nightStart" className={labelText}>
            Night starts
          </label>
          <input id="f-nightStart" type="time" value={start} onChange={(e) => onStart(e.target.value)} aria-invalid={error ? true : undefined} className={`${control} mt-1.5 tabular-nums`} />
        </div>
        <div>
          <label htmlFor="f-nightEnd" className={labelText}>
            Night ends
          </label>
          <input id="f-nightEnd" type="time" value={end} onChange={(e) => onEnd(e.target.value)} aria-invalid={error ? true : undefined} className={`${control} mt-1.5 tabular-nums`} />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      {isDefault && <p className="mt-2 text-xs text-muted">Not set for this site: the default 20:00 – 06:00 applies until you save a window.</p>}
    </Card>
  );
}

export function SiteSettingsSkeleton() {
  return (
    <div aria-busy="true" className="space-y-5 motion-safe:animate-pulse">
      <div className="h-28 rounded-xl bg-white" />
      <div className="h-52 rounded-xl bg-white" />
      <div className="h-44 rounded-xl bg-white" />
    </div>
  );
}

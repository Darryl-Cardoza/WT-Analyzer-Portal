import type { ReactNode } from "react";
import type { Coord } from "@/lib/alerts";

export function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside && <span className="text-xs font-medium text-muted">{aside}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const TONES = {
  ok: "border-ok/40 bg-ok/5 text-ok-ink",
  warn: "border-warn/40 bg-warn/10 text-warn-ink",
  neutral: "border-line bg-brand-faint/50 text-ink",
  caution: "border-yellow-400 bg-yellow-50 text-yellow-900",
  danger: "border-red-400 bg-red-50 text-red-900",
};

/** A headline number or verdict with a label and an optional line of context. */
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${TONES[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

/** Label / value pairs in two columns. */
export function Facts({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="mt-0.5 break-words font-medium">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-brand-faint px-3 py-2 text-sm text-brand-dark">{children}</p>;
}

/** Coordinates as a link to an external map (no embedded map in v1). */
export function CoordLink({ coord }: { coord: Coord | null }) {
  if (!coord) return <span className="text-muted">—</span>;
  const label = `${coord.lat.toFixed(6)}, ${coord.lon.toFixed(6)}`;
  return (
    <a
      href={`https://www.openstreetmap.org/?mlat=${coord.lat}&mlon=${coord.lon}#map=18/${coord.lat}/${coord.lon}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-dark underline-offset-2 hover:underline"
    >
      {label}
    </a>
  );
}

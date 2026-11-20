import { typeLabel } from "@/lib/alerts";

const base = "inline-block whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold";

export function TypeTag({ type }: { type: string }) {
  return <span className={`${base} border-line bg-white text-ink`}>{typeLabel(type)}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "RESOLVED"
      ? "border-ok bg-ok/5 text-ok-ink"
      : status.includes("ACKNOWLEDGED")
        ? "border-brand-dark bg-brand-faint text-brand-dark"
        : "border-line bg-white text-muted";
  return <span className={`${base} uppercase ${tone}`}>{status.replace(/_/g, " ") || "Unknown"}</span>;
}

/** Yes = the alert was a false positive; No = a true positive; dash = never classified. */
export function FalsePositiveBadge({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  return (
    <span className={`${base} ${value ? "border-warn bg-warn/10 text-warn-ink" : "border-ok bg-ok/5 text-ok-ink"}`}>
      {value ? "Yes" : "No"}
    </span>
  );
}

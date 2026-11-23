import Link from "next/link";

export interface Chip {
  label: string;
  href: string;
  active: boolean;
  /** No alerts match this option: shown dimmed and not clickable. */
  disabled?: boolean;
}

export function ChipRow({ label, chips }: { label: string; chips: Chip[] }) {
  return (
    <div role="group" aria-label={`Filter by ${label.toLowerCase()}`} className="flex flex-wrap items-center gap-2">
      <span aria-hidden="true" className="w-28 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {chips.map((chip) =>
        chip.disabled ? (
          <span key={chip.label} aria-disabled="true" className="cursor-not-allowed rounded-full border border-line bg-white px-4 py-1.5 text-xs font-medium text-ink/30">
            {chip.label}
          </span>
        ) : (
        <Link
          key={chip.label}
          href={chip.href}
          aria-current={chip.active ? "true" : undefined}
          className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
            chip.active
              ? "border-brand bg-brand-soft text-brand-dark"
              : "border-line bg-white text-ink/80 hover:bg-brand-faint"
          }`}
        >
          {chip.label}
        </Link>
        ),
      )}
    </div>
  );
}

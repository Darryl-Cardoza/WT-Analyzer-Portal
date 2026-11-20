// Placeholder mark until the real Wear-Tech logo SVG is provided.
export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 3 5 8v8c0 6.5 4.6 10.8 11 13 6.4-2.2 11-6.5 11-13V8L16 3Z" fill="var(--color-brand-soft)" stroke="var(--color-brand)" strokeWidth="2" strokeLinejoin="round" />
        <path d="m11 15 3.5 3.5L21 12" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold">Wear-Tech</div>
        <div className="text-[11px] text-muted">Alert Analyzer</div>
      </div>
    </div>
  );
}

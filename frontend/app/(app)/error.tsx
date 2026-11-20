"use client"; // error boundaries must be Client Components

export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-white px-6 py-12 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-1 text-sm text-muted">We couldn&apos;t load this page. The server may be busy or unreachable.</p>
      <button
        onClick={() => retry()}
        className="mt-5 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Try again
      </button>
    </div>
  );
}

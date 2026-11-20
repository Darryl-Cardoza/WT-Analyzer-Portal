import Link from "next/link";

/** Rendered in place (not thrown with notFound()): a throw after streaming has started makes React log an error and re-render on the client. */
export function NotFoundPanel() {
  return (
    <div className="rounded-xl border border-line bg-white px-6 py-12 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="mt-1 text-sm text-muted">This alert doesn&apos;t exist, or it belongs to another site.</p>
      <Link href="/alerts/" className="mt-5 inline-block rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
        Back to alerts
      </Link>
    </div>
  );
}

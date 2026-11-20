import Link from "next/link";
import { Logo } from "@/components/logo";

// Any URL that matches no page.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 border-t-4 border-accent px-4">
      <Logo />
      <div className="rounded-xl border border-line bg-white px-8 py-10 text-center">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-muted">The page you are looking for doesn&apos;t exist.</p>
        <Link href="/alerts/" className="mt-5 inline-block rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          Go to alerts
        </Link>
      </div>
    </main>
  );
}

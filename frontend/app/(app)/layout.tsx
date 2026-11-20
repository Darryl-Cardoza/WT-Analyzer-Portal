import { Suspense } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Sidebar, SidebarFallback } from "@/components/sidebar";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";

// Shell for every signed-in page. AuthGate keeps out visitors without a session; the sidebar reads the current URL,
// so it waits behind its own Suspense boundary.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="flex min-h-screen flex-col border-t-4 border-accent md:flex-row">
        {/* First stop for keyboard users: jump past the navigation */}
        <a
          href="#main"
          className="sr-only rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-dark shadow-lg focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50"
        >
          Skip to content
        </a>
        <Suspense fallback={<SidebarFallback />}>
          <Sidebar />
        </Suspense>
        <div className="min-w-0 flex-1">
          <Suspense fallback={<SiteHeaderFallback />}>
            <SiteHeader />
          </Suspense>
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-8 outline-none md:px-8">
            {children}
          </main>
        </div>
      </div>
    </AuthGate>
  );
}

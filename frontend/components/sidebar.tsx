"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";

// Add an entry here for each page.
// `active` also covers the alert detail page (/alert/), which belongs to the Alerts section.
const NAV = [
  { href: "/alerts/", label: "Alerts", active: (path: string) => /^\/alerts?(\/|$)/.test(path) },
  { href: "/site-settings/", label: "Site Settings", active: (path: string) => /^\/site-settings(\/|$)/.test(path) },
];

/** Reads the current URL, so the layout wraps it in <Suspense>. */
export function Sidebar() {
  return <SidebarView pathname={usePathname()} />;
}

/** Same sidebar without the active-link highlight: shown while the URL is not known yet. */
export function SidebarFallback() {
  return <SidebarView pathname="" />;
}

function SidebarView({ pathname }: { pathname: string }) {
  return (
    <>
      {/* Phone: slim top bar instead of the sidebar. A nav, not a header: the site header is the page's only banner. */}
      <nav aria-label="Main" className="flex items-center justify-between border-b border-line bg-white px-4 py-3 md:hidden">
        <Logo />
        <div className="flex gap-1">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} active={item.active(pathname)} />
          ))}
        </div>
      </nav>

      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-white px-3 py-5 md:flex">
        <div className="px-2 pb-6">
          <Logo />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} active={item.active(pathname)} />
          ))}
        </nav>
      </aside>
    </>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-brand-soft text-brand-dark" : "text-ink/80 hover:bg-brand-faint"
      }`}
    >
      {label}
    </Link>
  );
}

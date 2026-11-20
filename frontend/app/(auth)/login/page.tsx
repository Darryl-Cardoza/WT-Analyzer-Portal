import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in | Wear-Tech Alert Analyzer" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col gap-4 border-t-4 border-accent bg-page p-4 lg:flex-row lg:p-8">
      <main className="flex flex-1 items-center justify-center rounded-xl bg-white px-6 py-12 shadow-sm">
        <div className="w-full max-w-sm">
          <Logo />
          <h1 className="mt-10 text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in with your Wear-Tech site admin account.</p>
          <LoginForm />
        </div>
      </main>

      <aside className="hidden flex-[1.3] flex-col justify-between rounded-xl bg-gradient-to-br from-brand-dark via-brand to-accent p-10 text-white lg:flex">
        <div>
          <h2 className="text-4xl font-bold leading-tight">Understand every alert.</h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/85">
            Search a resident, pick a moment, and see what the devices recorded: GPS movement for
            geofence exits, fall probability against your site thresholds, and door activity.
          </p>
        </div>
        <span className="w-fit rounded-full border border-white/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider">
          Site alert analysis
        </span>
      </aside>
    </div>
  );
}

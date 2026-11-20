import { Suspense } from "react";
import { AlertsSkeleton, AlertsView } from "./alerts-view";

export const metadata = { title: "Alerts | Wear-Tech Alert Analyzer" };

export default function AlertsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Alerts</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Search alerts by resident email, date and time.</p>
      {/* The view reads the URL, so a static build needs it behind Suspense */}
      <Suspense fallback={<AlertsSkeleton />}>
        <AlertsView />
      </Suspense>
    </>
  );
}

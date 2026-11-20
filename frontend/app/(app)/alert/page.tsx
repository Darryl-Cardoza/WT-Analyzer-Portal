import { Suspense } from "react";
import { AlertDetailSkeleton, AlertDetailView } from "./alert-detail-view";

export const metadata = { title: "Alert | Wear-Tech Alert Analyzer" };

// One static page for every alert (/alert/?id=...): a static site cannot have a page per alert id.
export default function AlertPage() {
  return (
    <Suspense fallback={<AlertDetailSkeleton />}>
      <AlertDetailView />
    </Suspense>
  );
}

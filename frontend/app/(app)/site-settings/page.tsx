import { SiteSettingsView } from "./site-settings-view";

export const metadata = { title: "Site Settings | Wear-Tech Alert Analyzer" };

export default function SiteSettingsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Site Settings</h1>
      <p className="mb-5 mt-1 text-sm text-muted">The alert settings for your site. Changes apply to every resident at the site.</p>
      <SiteSettingsView />
    </>
  );
}

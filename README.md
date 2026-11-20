# Wear-Tech Alert Analyzer

Site admins search a resident's alerts by email and date/time and see what happened: GPS movement for
geofence ("Nest") alerts, fall probability against site thresholds, and door activity. Read-only.

It is a **static web app** (Next.js `output: "export"`, hosted on Azure Static Web Apps). The browser calls the API in
Mahi-Backend directly; there is no server of its own.

```
frontend/       the static app (Next.js, built to frontend/out)
claude-plans/   the design and phase plans
```

The API lives in Mahi-Backend (`/api/alert-analyzer`, files named `alertAnalyzer`). It starts with Mahi and uses Mahi's `.env`:

- `POST /api/alert-analyzer/auth/login` (the analyzer's own login: SITE-ADMIN or ADMIN only)
- `GET /api/alert-analyzer/me`, `GET /api/alert-analyzer/alerts`, `GET /api/alert-analyzer/alerts/:id` (need the `x-access-token` header)

No API key: the routes have their own login, and a key in a public bundle would protect nothing. Tests: `npm test` in Mahi-Backend.
The old NestJS backend was removed; a zip of it is kept outside the repo (`_archive/WT-Alert-Analyzer-backend-2026-11-20.zip`).

## Run it locally

1. In `frontend/`, copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_ANALYZER_API_URL`: the Mahi analyzer URL, e.g. `https://<mahi-host>:<port>/api/alert-analyzer`.
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: for the path maps. Public by nature: restrict it in Google Cloud to the site's referrers and the
     Maps JavaScript API. Without it the map shows a notice and the fixes table still works.
   These are public and fixed at build time, so rebuild after changing them. Never put a secret in them.
2. `npm install`, then `npm run dev`, and sign in with a site admin's `weartechUserId` and password.
   Mahi must allow the origin you browse from (its global `cors()` allows any).

## Test it

`npm test`, `npm run lint` and `npm run build` in `frontend/`. The Mahi side: `npm test` in Mahi-Backend.
Before a release, run the checklist in `weartech-backend/claude-plans/2026-11-20-alert-analyzer-staging-checklist.md`.

## Deploy

Build on **Linux with Node 20.12 or newer** (Azure's build, or CI). A Windows build works but names Next's prefetch files differently,
which shows as harmless 404s in the network tab.

```bash
cd frontend
NEXT_PUBLIC_ANALYZER_API_URL=https://<mahi-host>:<port>/api/alert-analyzer NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<key> npm run build
swa deploy ./out        # or upload out/ through the Azure portal or your pipeline
```

`npm run build` runs `next build` and then `scripts/swa-config.mjs`, which writes `out/staticwebapp.config.json`: security headers,
a Content-Security-Policy, `/` redirecting to `/alerts/`, rewrites for `/login`, `/alerts`, `/alert`, and the 404 page.
The build warns if the API URL is not https. Rollback: redeploy the previous build; nothing else depends on it.

## Things to know

- Routes: `/login`, `/alerts/` (search and list), `/alert/?id=<alertId>` (detail; a static export cannot build unknown ids).
- Sign-in token is kept in `sessionStorage`: each tab signs in separately and closing the tab ends the session. A 401/403 clears it and
  returns to `/login`. The time-zone choice (site time or UTC) is saved in `localStorage`, per browser.
- Only users with `userClass` `"SITE-ADMIN"` or `"ADMIN"` (and a `siteId`) can sign in, and each sees only their own site (`users.siteId`).
- Sessions last 12 hours. Five wrong passwords for one user ID lock it for 15 minutes (kept in Mahi's memory, so a restart resets it).
- Legacy passwords are not upgraded to bcrypt: the analyzer never writes. It shares Mahi's database connection but only calls
  `find`/`findOne`/`findById`, and its tests fail if it calls anything else.
- **CSP.** A static host cannot make a per-request nonce, so one policy covers every page: `script-src` allows `'self'`, a SHA-256 hash per
  inline script (collected from `out/**/*.html` by the build script), and the two Google Maps hosts; `style-src` needs `'unsafe-inline'`
  (Google Maps and the door chart inject styles); `connect-src` allows the Mahi origin. If you add a third-party script, image host or API
  the browser calls directly, add its origin in `scripts/swa-config.mjs` (`buildCsp`) and rebuild. The token is readable by page
  scripts, which is why scripts are hash-restricted.
- Mahi behind a proxy must pass `OPTIONS` through (preflight for `x-access-token`), and its certificate must be valid for browsers.

## Resident names

Names are stored encrypted by the main backend (MongoDB client-side field-level encryption). Mahi's analyzer decrypts them, read-only,
with Mahi's existing key settings, and returns them for the signed-in admin's own site only. If a name cannot be decrypted it is left
out; the API never returns encrypted values.

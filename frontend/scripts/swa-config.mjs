// Runs after `next build` (see package.json). Writes out/staticwebapp.config.json, the host config for Azure Static Web Apps:
// the security headers, including a Content-Security-Policy, plus the redirect and the 404 page.
//
// A static site has no server to make a fresh nonce per request, so the policy allows the page's own inline scripts by
// hash instead: every inline <script> in out/**/*.html is hashed and listed in script-src. One policy covers every page, because
// the app moves between pages without reloading and the browser keeps the policy of the page it first loaded.
//
// Needs Node 20 or newer.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// The API the app is built to call. Keep in step with the default in lib/api.ts (a test checks it).
export const DEFAULT_API_URL = "http://localhost:4000";

/** The CSP form of a script's hash: the browser hashes the UTF-8 text between the tags. */
export const scriptHash = (text) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

/** The bodies of the inline scripts in a page (scripts with a src are same-origin files, covered by 'self'). */
export function inlineScripts(html) {
  const bodies = [];
  for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(attributes) || body.length === 0) continue;
    bodies.push(body);
  }
  return bodies;
}

/** Hashes of every inline script on every page under `dir`, each once, sorted. */
export function collectHashes(dir) {
  const hashes = new Set();
  for (const file of readdirSync(dir, { recursive: true })) {
    if (!String(file).endsWith(".html")) continue;
    for (const body of inlineScripts(readFileSync(join(dir, String(file)), "utf8"))) hashes.add(scriptHash(body));
  }
  return [...hashes].sort();
}

/** CSP sources match origins, not paths: https://host:port/api/... -> https://host:port */
export function apiOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    throw new Error(`NEXT_PUBLIC_ANALYZER_API_URL is not a valid URL: "${url}"`);
  }
}

export function buildCsp({ hashes, apiOrigin: api }) {
  return [
    "default-src 'self'",
    // No 'unsafe-inline', no nonce, no 'strict-dynamic'. Google's two hosts are named because the map loader adds
    // Google's script at run time, and there is no nonce to trust it with.
    `script-src ${["'self'", ...hashes, "https://maps.googleapis.com", "https://maps.gstatic.com"].join(" ")}`,
    // Google Maps adds its own un-nonced <style> tags, and the door chart sets a style attribute. Styles only: never scripts.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' blob: data: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com",
    `connect-src 'self' ${api} https://*.googleapis.com`,
    "font-src 'self' https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function buildConfig({ hashes, apiOrigin: api }) {
  return {
    routes: [
      { route: "/", redirect: "/alerts/", statusCode: 302 },
      // The pages are folders (trailingSlash); these make the address without the slash work too, query string kept.
      ...["login", "alerts", "alert"].map((page) => ({ route: `/${page}`, rewrite: `/${page}/index.html` })),
    ],
    responseOverrides: { 404: { rewrite: "/404.html" } },
    globalHeaders: {
      "Content-Security-Policy": buildCsp({ hashes, apiOrigin: api }),
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    },
  };
}

// The same files, in the same order, that `next build` reads. A variable that is already set wins, as in Next.
function loadEnvFiles() {
  if (typeof process.loadEnvFile !== "function") return;
  for (const file of [".env.production.local", ".env.local", ".env.production", ".env"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

export function main(outDir = "out", { loadEnv = true } = {}) {
  if (!existsSync(outDir)) throw new Error(`No build found at ${outDir}: run "next build" first.`);
  if (loadEnv) loadEnvFiles();

  const url = process.env.NEXT_PUBLIC_ANALYZER_API_URL ?? DEFAULT_API_URL;
  const api = apiOrigin(url);
  if (!api.startsWith("https://")) {
    console.warn(`NEXT_PUBLIC_ANALYZER_API_URL (${url}) is not https: fine for local testing, but a deployed site must call an https API.`);
  }

  const hashes = collectHashes(outDir);
  if (hashes.length === 0) {
    throw new Error(`No inline scripts found in ${outDir}: refusing to write a policy that would block the app.`);
  }

  writeFileSync(join(outDir, "staticwebapp.config.json"), `${JSON.stringify(buildConfig({ hashes, apiOrigin: api }), null, 2)}\n`);
  console.log(`staticwebapp.config.json written: ${hashes.length} inline-script hashes, API origin ${api}`);
}

// Run directly (node scripts/swa-config.mjs), not when a test imports it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

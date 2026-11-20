import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_API_URL, apiOrigin, buildConfig, buildCsp, collectHashes, inlineScripts, main, scriptHash } from "./swa-config.mjs";

// SHA-256 of the text `alert(1)`, base64: the value `openssl dgst -sha256 -binary | openssl base64` gives.
const ALERT_1 = "bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI=";

const directives = (csp) => Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "swa-config-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const page = (rel, html) => {
  const file = join(dir, rel);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, html);
};

describe("scriptHash", () => {
  it("is the quoted sha256-base64 form a CSP expects", () => {
    expect(scriptHash("alert(1)")).toBe(`'sha256-${ALERT_1}'`);
  });
  it("hashes the UTF-8 bytes, as browsers do", () => {
    expect(scriptHash('var s = "café — ✓";')).toBe("'sha256-80cgp47wuprV0MwdshuzqE3Tr1v2sTfyi7kkBnIEcew='");
  });
  it("changes with a single character, including whitespace", () => {
    expect(scriptHash("alert(1) ")).not.toBe(scriptHash("alert(1)"));
  });
});

describe("inlineScripts", () => {
  it("returns the body of each inline script, exactly as written", () => {
    const html = "<html><script>alert(1)</script><p>x</p><script>\n  self.a = 1;\n</script></html>";
    expect(inlineScripts(html)).toEqual(["alert(1)", "\n  self.a = 1;\n"]);
  });
  it("skips scripts with a src (same-origin files are covered by 'self')", () => {
    expect(inlineScripts('<script src="/_next/static/a.js" async></script><script>x()</script>')).toEqual(["x()"]);
    expect(inlineScripts("<script async src='/a.js'></script>")).toEqual([]);
  });
  it("copes with attributes and upper case", () => {
    expect(inlineScripts('<SCRIPT id="_R_" async>boot()</SCRIPT>')).toEqual(["boot()"]);
  });
  it("skips empty scripts and pages without scripts", () => {
    expect(inlineScripts("<script></script>")).toEqual([]);
    expect(inlineScripts("<p>hello</p>")).toEqual([]);
  });
});

describe("collectHashes", () => {
  it("hashes the inline scripts of every page in every folder, once each, sorted", () => {
    page("index.html", "<script>alert(1)</script><script>b()</script>");
    page("alerts/index.html", "<script>alert(1)</script><script>a()</script>");
    page("deep/er/x.html", "<script>c()</script>");
    page("notes.txt", "<script>ignored()</script>");
    const hashes = collectHashes(dir);
    expect(hashes).toHaveLength(4);
    expect(hashes).toEqual([...hashes].sort());
    expect(hashes).toContain(scriptHash("alert(1)"));
    expect(hashes).not.toContain(scriptHash("ignored()"));
  });
  it("is empty when no page has an inline script", () => {
    page("index.html", "<p>hi</p>");
    expect(collectHashes(dir)).toEqual([]);
  });
});

describe("DEFAULT_API_URL", () => {
  it("is the default the app itself is built with (lib/api.ts), so the policy allows the origin the app calls", () => {
    const api = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
    expect(api).toContain(`process.env.NEXT_PUBLIC_ANALYZER_API_URL ?? "${DEFAULT_API_URL}"`);
  });
});

describe("apiOrigin", () => {
  it("keeps scheme, host and port and drops the path (CSP matches origins)", () => {
    expect(apiOrigin("https://mahi.example.org:8084/api/alert-analyzer")).toBe("https://mahi.example.org:8084");
    expect(apiOrigin("http://localhost:4000")).toBe("http://localhost:4000");
    expect(apiOrigin("https://mahi.example.org/api/alert-analyzer/")).toBe("https://mahi.example.org");
  });
  it("says what is wrong when it is not a URL", () => {
    expect(() => apiOrigin("not a url")).toThrow(/NEXT_PUBLIC_ANALYZER_API_URL/);
    expect(() => apiOrigin("")).toThrow(/NEXT_PUBLIC_ANALYZER_API_URL/);
  });
});

describe("buildCsp", () => {
  const hashes = [scriptHash("a()"), scriptHash("b()")];
  const csp = buildCsp({ hashes, apiOrigin: "https://mahi.example.org:8084" });
  const d = directives(csp);

  it("lets scripts run only from this site, the page's own inline scripts (by hash) and Google Maps", () => {
    expect(d["script-src"]).toEqual(["'self'", ...hashes, "https://maps.googleapis.com", "https://maps.gstatic.com"]);
  });
  it("never allows inline or eval'd script, and has no nonce mechanism left over", () => {
    expect(d["script-src"].join(" ")).not.toMatch(/unsafe-|strict-dynamic|nonce-|\*/);
  });
  it("allows the API's origin to be called, and Google's, and nothing else", () => {
    expect(d["connect-src"]).toEqual(["'self'", "https://mahi.example.org:8084", "https://*.googleapis.com"]);
    expect(csp.split("https://mahi.example.org:8084").length - 1).toBe(1); // only in connect-src
  });
  it("allows inline styles (Google Maps adds its own) but only styles", () => {
    expect(d["style-src"]).toEqual(["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]);
    expect(d["default-src"]).toEqual(["'self'"]);
  });
  it("blocks plugins, framing, foreign base URLs and foreign form targets, and upgrades http", () => {
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
    expect(d["form-action"]).toEqual(["'self'"]);
    expect(csp).toContain("upgrade-insecure-requests");
  });
  it("keeps Google Maps' images, fonts and worker allowed", () => {
    expect(d["img-src"]).toEqual(expect.arrayContaining(["'self'", "blob:", "data:", "https://*.googleapis.com", "https://*.gstatic.com"]));
    expect(d["font-src"]).toEqual(["'self'", "https://fonts.gstatic.com"]);
    expect(d["worker-src"]).toEqual(["'self'", "blob:"]);
  });
  it("is one line (it becomes an HTTP header value)", () => {
    expect(csp).not.toMatch(/[\r\n]/);
  });
});

describe("buildConfig", () => {
  const config = buildConfig({ hashes: [scriptHash("a()")], apiOrigin: "https://mahi.example.org" });

  it("sets the CSP and the other security headers on every response", () => {
    expect(config.globalHeaders["Content-Security-Policy"]).toBe(buildCsp({ hashes: [scriptHash("a()")], apiOrigin: "https://mahi.example.org" }));
    expect(config.globalHeaders["X-Frame-Options"]).toBe("DENY");
    expect(config.globalHeaders["X-Content-Type-Options"]).toBe("nosniff");
    expect(config.globalHeaders["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(config.globalHeaders["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(config.globalHeaders["Strict-Transport-Security"]).toMatch(/^max-age=\d+/);
  });
  it("redirects the home page to the alerts and serves the pages without the trailing slash too (query kept)", () => {
    const by = Object.fromEntries(config.routes.map((r) => [r.route, r]));
    expect(by["/"]).toEqual({ route: "/", redirect: "/alerts/", statusCode: 302 });
    for (const p of ["login", "alerts", "alert"]) expect(by[`/${p}`]).toEqual({ route: `/${p}`, rewrite: `/${p}/index.html` });
  });
  it("answers an unknown address with the 404 page", () => {
    expect(config.responseOverrides["404"]).toEqual({ rewrite: "/404.html" });
  });
  it("survives a JSON round trip (it is written to a file)", () => {
    expect(JSON.parse(JSON.stringify(config))).toEqual(config);
  });
});

describe("main", () => {
  const withBuild = () => {
    page("index.html", "<script>alert(1)</script>");
    page("alerts/index.html", "<script>alert(1)</script><script>other()</script>");
  };

  it("writes staticwebapp.config.json into the build folder, with the hashes and the API origin", () => {
    withBuild();
    vi.stubEnv("NEXT_PUBLIC_ANALYZER_API_URL", "https://mahi.example.org:8084/api/alert-analyzer");
    main(dir, { loadEnv: false });
    const config = JSON.parse(readFileSync(join(dir, "staticwebapp.config.json"), "utf8"));
    const csp = config.globalHeaders["Content-Security-Policy"];
    expect(csp).toContain(scriptHash("alert(1)"));
    expect(csp).toContain(scriptHash("other()"));
    expect(directives(csp)["connect-src"]).toContain("https://mahi.example.org:8084");
  });

  it("refuses to run without a build", () => {
    expect(() => main(join(dir, "missing"), { loadEnv: false })).toThrow(/build/i);
  });

  it("refuses to write a policy that would block the app, when no page has an inline script", () => {
    page("index.html", "<p>hi</p>");
    vi.stubEnv("NEXT_PUBLIC_ANALYZER_API_URL", "https://mahi.example.org");
    expect(() => main(dir, { loadEnv: false })).toThrow(/inline script/i);
  });

  it("warns when the build points at a plain-http API (a real deploy needs https)", () => {
    withBuild();
    vi.stubEnv("NEXT_PUBLIC_ANALYZER_API_URL", "http://localhost:4000");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    main(dir, { loadEnv: false });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/not https/i));
  });

  it("does not warn for an https API", () => {
    withBuild();
    vi.stubEnv("NEXT_PUBLIC_ANALYZER_API_URL", "https://mahi.example.org/api/alert-analyzer");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    main(dir, { loadEnv: false });
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to the same default API URL the app is built with", () => {
    withBuild();
    vi.stubEnv("NEXT_PUBLIC_ANALYZER_API_URL", "");
    delete process.env.NEXT_PUBLIC_ANALYZER_API_URL;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    main(dir, { loadEnv: false });
    const config = JSON.parse(readFileSync(join(dir, "staticwebapp.config.json"), "utf8"));
    expect(directives(config.globalHeaders["Content-Security-Policy"])["connect-src"]).toContain("http://localhost:4000");
  });
});

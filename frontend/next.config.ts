import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A static site: `next build` writes plain HTML/CSS/JS to out/, served by Azure Static Web Apps. There is no Next.js server,
  // so no cookies, server actions, proxy, redirects or headers() here. Security headers (CSP, framing, referrer...) are set
  // by the host instead, in staticwebapp.config.json.
  output: "export",
  // /alerts -> /alerts/index.html, which is how a static host serves a folder.
  trailingSlash: true,
  allowedDevOrigins: ["*.ngrok-free.dev"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

/**
 * Security headers for every response. These only control who may embed *this* site
 * (nobody), so the YouTube player embedded inside the app keeps working.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
/** Proxied artwork may never run scripts or load anything, even if opened directly. */
const IMAGE_CSP = "default-src 'none'; sandbox; frame-ancestors 'none'";

const nextConfig: NextConfig = {
  // Docker builds set NEXT_OUTPUT=standalone for a small self-contained server (see the
  // Dockerfile); Vercel and `npm start` keep the default output
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  cacheComponents: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // config headers override route headers, so each CSP lives here
      { source: "/((?!api/image).*)", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'none'" }] },
      { source: "/api/image", headers: [{ key: "Content-Security-Policy", value: IMAGE_CSP }] },
    ];
  },
  partialPrefetching: true,
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

import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  poweredByHeader: false,
  experimental: { cpus: 1 },
  async redirects() {
    // Compatibility only: actual module pages and handlers live under their
    // own namespaces. 307 preserves methods, request bodies and query strings.
    const pages = ["dashboard", "scripts", "characters", "assets", "integrations", "activity", "settings", "login"];
    const apis = ["auth", "settings", "agent-keys", "assets", "characters", "scripts", "openapi", "health"];
    const legacyApis = ["users", "projects", "dashboard", "activities"];
    return [
      ...pages.map(name => ({ source: `/${name}/:path*`, destination: `/studio/${name}/:path*`, permanent: false })),
      { source: "/projects/:path*", destination: "/studio/scripts/:path*", permanent: false },
      { source: "/users/:path*", destination: "/studio/characters/:path*", permanent: false },
      ...apis.map(name => ({ source: `/api/${name}/:path*`, destination: `/api/studio/${name}/:path*`, permanent: false })),
      ...legacyApis.map(name => ({ source: `/api/${name}/:path*`, destination: `/api/studio/legacy/${name}/:path*`, permanent: false })),
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
    ] }];
  }
};
export default config;

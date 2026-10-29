import type { NextConfig } from "next";
import { apiBaseUrl } from "./src/lib/config";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // D015: the browser calls /api/* on this origin; Next forwards it to Express. The session cookie is
  // first-party, and API_BASE_URL never reaches the browser.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiBaseUrl()}/api/:path*` }];
  },
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

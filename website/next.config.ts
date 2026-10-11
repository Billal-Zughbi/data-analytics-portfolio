import type { NextConfig } from "next";

// Static export: the site is plain HTML/CSS/JS and can be hosted on Vercel,
// GitHub Pages or any static host. Set NEXT_PUBLIC_BASE_PATH (for example
// "/data-analytics-portfolio") when serving from a GitHub Pages project URL.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  productionBrowserSourceMaps: false,
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

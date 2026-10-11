import type { NextConfig } from "next";

// Static export so the site can be hosted on GitHub Pages, Vercel or any CDN.
// Set NEXT_PUBLIC_BASE_PATH=/data-analytics-portfolio when serving from a GitHub Pages project URL.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;

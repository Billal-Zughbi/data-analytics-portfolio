import { profile } from "./profile";

/**
 * Public URL of the deployed site. Read from NEXT_PUBLIC_SITE_URL at build time.
 * Left undefined until a real domain exists, so the site never advertises a
 * made-up canonical URL.
 */
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || undefined;

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const siteTitle = `${profile.name} · ${profile.title}`;

export const siteDescription =
  "Portfolio of Billal Zughbi, an Analytics Engineer working in Power BI, SQL, Python, Snowflake and Microsoft Fabric.";

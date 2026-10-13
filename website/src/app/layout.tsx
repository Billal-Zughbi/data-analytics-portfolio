import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ConsoleHello } from "@/components/surprises/ConsoleHello";
import { siteDescription, siteTitle, siteUrl } from "@/content/site";
import { profile } from "@/content/profile";

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: { default: siteTitle, template: `%s · ${profile.name}` },
  description: siteDescription,
  authors: [{ name: profile.name, url: profile.links.linkedin }],
  openGraph: {
    type: "website",
    title: siteTitle,
    description: siteDescription,
    siteName: profile.name,
    locale: "en_US",
  },
  twitter: { card: "summary", title: siteTitle, description: siteDescription },
  ...(siteUrl ? { alternates: { canonical: "/" } } : {}),
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Marks that JS is running so scroll reveals may start hidden. Without JS, content is simply visible. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-dvh bg-bg text-ink-1">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-surface-3 focus:px-4 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <SiteNav />
        <main id="main">{children}</main>
        <SiteFooter />
        <ConsoleHello />
      </body>
    </html>
  );
}

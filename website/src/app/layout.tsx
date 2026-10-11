import type { Metadata } from "next";
import Link from "next/link";
import { profile } from "@/data/profile";
import "./globals.css";

export const metadata: Metadata = {
  title: `${profile.name} | ${profile.title}`,
  description: profile.summary,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav" aria-label="Main">
          <div className="container">
            <Link href="/" className="brand">
              {profile.name}
            </Link>
            <ul>
              <li className="hide-sm">
                <Link href="/#experience">Experience</Link>
              </li>
              <li>
                <Link href="/#projects">Projects</Link>
              </li>
              <li className="hide-sm">
                <Link href="/#skills">Skills</Link>
              </li>
              <li>
                <Link href="/#contact">Contact</Link>
              </li>
            </ul>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="footer">
          <div className="container">
            © {new Date().getFullYear()} {profile.name} · Built with Next.js ·{" "}
            <a href={profile.repo}>Source on GitHub</a>
          </div>
        </footer>
      </body>
    </html>
  );
}

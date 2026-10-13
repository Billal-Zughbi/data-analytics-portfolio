import Link from "next/link";
import { navigation, profile } from "@/content/profile";
import { projects } from "@/content/projects";
import { Monogram } from "./Monogram";

const BUILD_YEAR = 2026;

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface-1/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Monogram className="h-8 w-8" />
            <p className="font-medium">{profile.name}</p>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-3">
            {profile.title}. {profile.location}.
          </p>
          <p className="mt-6 font-mono text-[0.6875rem] leading-relaxed text-ink-3">
            Built with Next.js, React Three Fiber and Recharts.{" "}
            <a className="underline decoration-line-strong underline-offset-4 hover:text-ink-1" href={profile.links.repository}>
              Source on GitHub
            </a>
            . The contour lines in the background are Mount Rainier, drawn from USGS elevation data.
          </p>
        </div>

        <nav aria-label="Footer">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3">Sections</p>
          <ul className="mt-4 space-y-2 text-sm">
            {navigation.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-ink-2 hover:text-ink-1">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3">{projects.length === 1 ? "Project" : "Projects"}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {projects.map((p) => (
              <li key={p.slug}>
                <Link href={`/projects/${p.slug}/`} className="text-ink-2 hover:text-ink-1">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3">Elsewhere</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a href={profile.links.linkedin} className="text-ink-2 hover:text-ink-1">LinkedIn</a>
            </li>
            <li>
              <a href={profile.links.github} className="text-ink-2 hover:text-ink-1">GitHub</a>
            </li>
            <li>
              <a href={`mailto:${profile.email}`} className="text-ink-2 hover:text-ink-1">Email</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 font-mono text-[0.6875rem] text-ink-3 sm:px-6">
          © {BUILD_YEAR} {profile.name}
        </p>
      </div>
    </footer>
  );
}

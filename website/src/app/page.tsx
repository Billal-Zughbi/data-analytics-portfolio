import { Hero } from "@/components/home/Hero";
import { ProjectCard } from "@/components/home/ProjectCard";
import { previewFor } from "@/components/home/previews";
import { Portrait } from "@/components/home/Portrait";
import { Workflow } from "@/components/home/Workflow";
import { Experience } from "@/components/home/Experience";
import { Skills } from "@/components/home/Skills";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { ExternalIcon } from "@/components/icons";
import { profile } from "@/content/profile";
import { projects } from "@/content/projects";

export default function HomePage() {
  return (
    <>
      <Hero />

      <Section
        id="projects"
        sheet
        index="01"
        eyebrow="Selected projects"
        title="Projects I've built on my own."
        intro="Each write-up covers the question, the data, the code and the checks I ran, with everything in the GitHub repository."
      >
        <div className="space-y-6">
          {projects.map((p, i) => (
            <Reveal key={p.slug}>
              <ProjectCard project={p} index={i} preview={previewFor(p.slug)} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        id="workflow"
        index="02"
        eyebrow="How I work"
        title="How I approach a reporting project."
        intro="These are roughly the steps I follow at work and in the projects here."
        className="border-y border-line bg-surface-1/30"
      >
        <Workflow />
      </Section>

      <Section
        id="experience"
        index="03"
        eyebrow="Experience"
        title="BI and analytics work at Arconic."
      >
        <Experience />
      </Section>

      <Section
        id="skills"
        index="04"
        eyebrow="Toolkit"
        title="Tools I work with."
        className="border-y border-line bg-surface-1/30"
      >
        <Skills />
      </Section>

      <Section id="about" index="05" eyebrow="About" title={profile.aboutTitle}>
        <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.4fr] lg:gap-14">
          <Reveal className="lg:sticky lg:top-28">
            <Portrait />
          </Reveal>
          <Reveal delay={0.1}>
            <div className="space-y-5 text-lg leading-relaxed text-ink-2 text-pretty">
              {profile.about.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
            <div className="node-rule my-8" aria-hidden />
            <dl>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Education</dt>
                <dd className="mt-3">
                  <p className="font-semibold text-ink-1">{profile.education.degree}</p>
                  <p className="text-ink-2">{profile.education.school}</p>
                  <p className="mt-1 text-sm text-ink-3">
                    {profile.education.location} · {profile.education.date}
                  </p>
                </dd>
              </div>
            </dl>
          </Reveal>
        </div>
      </Section>

      <Section
        id="contact"
        index="06"
        eyebrow="Contact"
        title="Get in touch."
        intro="Email is the best way to reach me. I'm also on LinkedIn and GitHub."
        className="border-t border-line"
      >
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href={`mailto:${profile.email}`}
              className="glow-accent inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 font-semibold text-bg transition-transform duration-300 hover:-translate-y-0.5"
            >
              {profile.email}
            </a>
            <a
              href={profile.links.linkedin}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line-strong px-6 font-medium transition-colors hover:border-accent"
            >
              LinkedIn <ExternalIcon className="h-3.5 w-3.5 text-ink-3" />
            </a>
            <a
              href={profile.links.github}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line-strong px-6 font-medium transition-colors hover:border-accent"
            >
              GitHub <ExternalIcon className="h-3.5 w-3.5 text-ink-3" />
            </a>
          </div>
        </Reveal>
      </Section>
    </>
  );
}

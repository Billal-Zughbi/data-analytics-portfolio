import { Hero } from "@/components/home/Hero";
import { ProjectCard } from "@/components/home/ProjectCard";
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
        index="01"
        eyebrow="Selected projects"
        title="Independent work, documented end to end."
        intro="Each case study shows the question, the data, the pipeline, the model and the checks behind every number, with the code in the repository."
      >
        <div className="space-y-6">
          {projects.map((p, i) => (
            <Reveal key={p.slug}>
              <ProjectCard project={p} index={i} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        id="workflow"
        index="02"
        eyebrow="How I work"
        title="Four steps between a raw table and a decision."
        intro="The same sequence runs through my professional reporting and these projects. The tools change; the order of operations doesn't."
        className="border-y border-line bg-surface-1/30"
      >
        <Workflow />
      </Section>

      <Section
        id="experience"
        index="03"
        eyebrow="Experience"
        title="Enterprise BI in a multi-unit manufacturing organization."
      >
        <Experience />
      </Section>

      <Section
        id="skills"
        index="04"
        eyebrow="Toolkit"
        title="The stack I use every week."
        className="border-y border-line bg-surface-1/30"
      >
        <Skills />
      </Section>

      <Section id="about" index="05" eyebrow="About" title="Analytics engineering, with the business in the room.">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <Reveal>
            <div className="space-y-5 text-lg leading-relaxed text-ink-2 text-pretty">
              {profile.about.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-[var(--radius-md)] border border-line bg-surface-1 p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Education</p>
              <p className="mt-3 font-semibold">{profile.education.degree}</p>
              <p className="text-ink-2">{profile.education.school}</p>
              <p className="mt-1 text-sm text-ink-3">
                {profile.education.location} · {profile.education.date}
              </p>
              <div className="node-rule my-6" aria-hidden />
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Based in</p>
              <p className="mt-3 text-ink-2">{profile.location}</p>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section
        id="contact"
        index="06"
        eyebrow="Contact"
        title="Hiring for BI, analytics engineering or Power BI work?"
        intro="Email is the quickest way to reach me. I'm also on LinkedIn and GitHub."
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

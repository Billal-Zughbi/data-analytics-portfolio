import Link from "next/link";
import { education, experience, profile, projects, skills } from "@/data/profile";

export default function Home() {
  return (
    <>
      <header className="hero container">
        <p className="eyebrow">{profile.title}</p>
        <h1>{profile.name}</h1>
        <p className="lead">{profile.summary}</p>
        <div className="actions">
          <Link className="btn primary" href="/#projects">
            View projects
          </Link>
          <a className="btn" href={`mailto:${profile.email}`}>
            Get in touch
          </a>
        </div>
      </header>

      <section aria-labelledby="impact">
        <div className="container">
          <h2 id="impact">Impact at a glance</h2>
          <div className="stats">
            {profile.stats.map((s) => (
              <div className="tile" key={s.label}>
                <div className="value">{s.value}</div>
                <div className="label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="experience" aria-labelledby="experience-h">
        <div className="container">
          <h2 id="experience-h">Experience</h2>
          {experience.map((job) => (
            <article className="job" key={job.role + job.period}>
              <div className="job-head">
                <h3>
                  {job.role} · {job.company}
                </h3>
                <span className="meta">
                  {job.location} · {job.period}
                </span>
              </div>
              <ul>
                {job.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </article>
          ))}
          <article className="job">
            <div className="job-head">
              <h3>{education.degree}</h3>
              <span className="meta">
                {education.school} · {education.period}
              </span>
            </div>
          </article>
        </div>
      </section>

      <section id="projects" aria-labelledby="projects-h">
        <div className="container">
          <h2 id="projects-h">Projects</h2>
          <div className="cards">
            {projects.map((p) => (
              <article className="card" key={p.slug}>
                <h3>{p.title}</h3>
                <p>{p.summary}</p>
                <ul className="tags" aria-label="Tools">
                  {p.stack.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <div className="links">
                  <Link href={`/projects/${p.slug}/`}>Case study</Link>
                  <a href={`${profile.repo}/tree/main/${p.repoPath}`}>Code</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="skills" aria-labelledby="skills-h">
        <div className="container">
          <h2 id="skills-h">Skills</h2>
          {skills.map((g) => (
            <div className="skill-group" key={g.group}>
              <h3>{g.group}</h3>
              <ul className="tags">
                {g.items.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" aria-labelledby="contact-h">
        <div className="container">
          <h2 id="contact-h">Contact</h2>
          <p className="lead">
            Based in {profile.location}. Reach me at <a href={`mailto:${profile.email}`}>{profile.email}</a> or on{" "}
            <a href={profile.github}>GitHub</a>.
          </p>
        </div>
      </section>
    </>
  );
}

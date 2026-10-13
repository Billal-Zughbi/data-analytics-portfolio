import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-center px-4 pt-16 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">404 · no rows returned</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Page not found.</h1>
      <p className="mt-4 max-w-lg text-ink-2">The link may be out of date. My project and contact details are on the home page.</p>
      <Link href="/" className="mt-8 inline-flex h-11 w-fit items-center rounded-full bg-accent px-5 text-sm font-semibold text-bg">
        Go to the home page
      </Link>
    </section>
  );
}

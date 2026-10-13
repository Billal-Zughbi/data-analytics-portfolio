import { splitMentions, toolFor, type Tool } from "@/content/tools";

/*
 * Server-rendered pieces of the page filter (the client side is ToolFilter.tsx):
 *  - buttons carry data-tool="slug" and select that tool;
 *  - elements carry data-xf="slug slug" and light up or dim while a tool is selected;
 *  - [data-pin] marks where a matching element shows the tool's logo;
 *  - tool names inside text are wrapped in data-mention spans so they can be highlighted.
 */

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** The official logo file, shown as is. Dark logos sit on a light plate; the image itself is never altered. */
export function ToolLogo({ tool, size }: { tool: Tool; size: number }) {
  if (!tool.logo) return null;
  if (tool.plate) {
    return (
      <span aria-hidden className="logo-plate shrink-0" style={{ width: Math.round(size * 0.8), height: Math.round(size * 0.8) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
        <img src={`${base}${tool.logo}`} alt="" width={size} height={size} loading="lazy" decoding="async" style={{ width: "auto", height: Math.round(size * 0.5) }} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export
    <img
      src={`${base}${tool.logo}`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="tool-logo block shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

/** A tool name that filters the page when clicked. `label` can be longer than the tool name ("SQL checks"). */
export function ToolChip({ label, className = "", logoSize = 14 }: { label: string; className?: string; logoSize?: number }) {
  const tool = toolFor(label);
  return (
    <button
      type="button"
      data-tool={tool.slug}
      aria-pressed="false"
      className={`tool-chip inline-flex items-center gap-1.5 ${className}`}
      style={tool.color ? ({ "--tool": tool.color } as React.CSSProperties) : undefined}
    >
      <ToolLogo tool={tool} size={logoSize} />
      {label}
    </button>
  );
}

/** Large logo tile for the Skills slicer. */
export function ToolTile({ tool }: { tool: Tool }) {
  return (
    <button
      type="button"
      data-tool={tool.slug}
      aria-pressed="false"
      className="tool-tile flex h-[5.5rem] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-line bg-surface-2 px-1.5 text-center"
      style={tool.color ? ({ "--tool": tool.color } as React.CSSProperties) : undefined}
    >
      <span className="tool-tile-logo flex h-8 w-8 items-center justify-center">
        <ToolLogo tool={tool} size={32} />
      </span>
      <span className="text-[0.75rem] leading-tight text-ink-2">{tool.name}</span>
    </button>
  );
}

/** Text with each tool mention wrapped so the filter can highlight it. */
export function Mentions({ text }: { text: string }) {
  return (
    <>
      {splitMentions(text).map((p, i) =>
        p.slug ? (
          <span key={i} data-mention={p.slug}>
            {p.text}
          </span>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

/** Where a matching element shows the selected tool's logo. */
export function Pin({ className = "" }: { className?: string }) {
  return <span aria-hidden data-pin className={className} />;
}

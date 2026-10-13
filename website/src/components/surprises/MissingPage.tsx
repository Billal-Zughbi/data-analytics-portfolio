"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const currentPath = () => {
  try {
    return decodeURI(window.location.pathname);
  } catch {
    return window.location.pathname;
  }
};

/** The 404 page's query, filled in with the address the visitor asked for. Shown only in the browser. */
export function MissingPage() {
  const path = useSyncExternalStore(subscribe, currentPath, () => null);
  if (!path) return null;
  return (
    <pre className="mt-8 max-w-xl overflow-x-auto whitespace-pre-wrap break-all rounded-[var(--radius-md)] border border-line bg-surface-1 p-4 font-mono text-[0.8125rem] leading-relaxed text-ink-2">
      <code>
        <span className="text-accent-2">SELECT</span> *{"\n"}
        <span className="text-accent-2">FROM</span> pages{"\n"}
        <span className="text-accent-2">WHERE</span> path = <span className="text-warn">&apos;{path}&apos;</span>;{"\n\n"}
        <span className="text-ink-3">-- 0 rows returned</span>
      </code>
    </pre>
  );
}

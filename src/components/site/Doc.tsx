// Building blocks for the /system, /protocol and /architecture pages: a terminal-style hero,
// a sticky index, numbered sections and code blocks. Server components, no client JS.

import type { ReactNode } from 'react';
import { HudPanel, Prompt } from '@/components/hud/Hud';

export function PageHero({
  command,
  title,
  lead,
  meta,
}: {
  command: string;
  title: string;
  lead: string;
  meta: [string, string][];
}) {
  return (
    <header className="relative mx-auto max-w-[1280px] px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
      <Prompt>{command}</Prompt>
      <h1
        className="glitch mt-6 font-mono text-5xl font-extrabold tracking-tight text-white sm:text-7xl"
        data-text={title}
      >
        {title}
        <span className="caret-blink text-phosphor">_</span>
      </h1>
      <p className="mt-6 max-w-3xl border-l-2 border-phosphor/60 pl-4 text-base leading-relaxed text-dim sm:text-lg">
        {lead}
      </p>
      <dl className="mt-10 grid max-w-3xl grid-cols-2 border border-phosphor/20 bg-black/60 font-mono sm:grid-cols-4">
        {meta.map(([k, v]) => (
          <div
            key={k}
            className="border-phosphor/15 p-4 [&:not(:last-child)]:border-r max-sm:[&:nth-child(-n+2)]:border-b max-sm:[&:nth-child(2)]:border-r-0"
          >
            <dt className="text-[10px] tracking-[0.3em] text-dim">{k}</dt>
            <dd className="mt-1 text-lg font-bold text-phosphor">{v}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

/** Content with a sticky section index on wide screens. */
export function DocLayout({ toc, children }: { toc: { id: string; label: string }[]; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1280px] gap-12 px-4 pb-28 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav className="sticky top-28 border-l border-phosphor/15 pl-5 font-mono" aria-label="On this page">
          <p className="mb-4 text-[10px] tracking-[0.35em] text-dim">{'// INDEX'}</p>
          <ol className="space-y-3">
            {toc.map((t, i) => (
              <li key={t.id}>
                <a
                  href={'#' + t.id}
                  className="text-[11px] tracking-[0.25em] text-phosphor/60 transition-colors hover:text-phosphor"
                >
                  <span className="text-dim">{String(i + 1).padStart(2, '0')} </span>
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function DocSection({
  id,
  index,
  kicker,
  title,
  children,
}: {
  id: string;
  index: string;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-phosphor/10 py-14 first:border-t-0 first:pt-0">
      <p className="font-mono text-[11px] tracking-[0.35em] text-phosphor/70">
        <span className="text-phosphor">[{index}] </span>
        {kicker}
      </p>
      <h2 className="mt-3 font-mono text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{title}</h2>
      <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-dim">{children}</div>
    </section>
  );
}

export function CodeBlock({ label, status, children }: { label: string; status?: string; children: string }) {
  return (
    <HudPanel label={label} status={status} tone="idle" bodyClassName="overflow-x-auto p-5">
      <pre className="font-mono text-[12.5px] leading-6 text-phosphor/90">{children}</pre>
    </HudPanel>
  );
}

/** "Term — explanation" rows with a phosphor marker. */
export function Points({ items }: { items: [string, ReactNode][] }) {
  return (
    <ul className="space-y-4">
      {items.map(([term, body]) => (
        <li key={term} className="grid gap-1 sm:grid-cols-[180px_1fr] sm:gap-6">
          <span className="font-mono text-xs font-bold tracking-[0.2em] text-phosphor">▸ {term}</span>
          <span>{body}</span>
        </li>
      ))}
    </ul>
  );
}

/** Mono table on a HUD panel; the first column is the key. */
export function DataTable({ label, head, rows }: { label: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <HudPanel label={label} bodyClassName="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-phosphor/15 font-mono text-[10px] tracking-[0.3em] text-dim">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-phosphor/10 align-top last:border-b-0">
              {r.map((cell, j) => (
                <td key={j} className={'px-4 py-3 ' + (j === 0 ? 'font-mono text-phosphor' : 'text-dim')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </HudPanel>
  );
}

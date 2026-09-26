'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/lib/use-api';
import type { TailoredView } from '@/lib/overclock';
import { CopyButton } from '@/components/hud/CopyButton';

function Heading({ children }: { children: string }) {
  return <p className="mb-2 mt-6 font-mono text-[10px] tracking-[0.35em] text-phosphor/70 first:mt-0">{children}</p>;
}

/** Review of one tailored resume: the document, what changed, what is still missing, and the cover note. */
export function TailorPreview({ id }: { id: string }) {
  const api = useApi();
  const [view, setView] = useState<TailoredView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api('/api/overclock/' + id)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
        if (!cancelled) setView(d);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  if (error) return <p className="font-mono text-sm text-hud-red">{error}</p>;
  if (!view) return <div className="h-64 animate-pulse bg-phosphor/[0.04]" aria-busy="true" />;
  const r = view.resume;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <article className="border border-phosphor/15 bg-black/60 p-5 text-sm leading-relaxed text-ink/90">
        <p className="text-xl font-bold text-white">{r.name}</p>
        {r.headline && <p className="text-dim">{r.headline}</p>}
        {r.contact.length > 0 && <p className="mt-1 font-mono text-[11px] text-dim">{r.contact.join(' · ')}</p>}
        {r.summary && (
          <>
            <Heading>SUMMARY</Heading>
            <p>{r.summary}</p>
          </>
        )}
        {r.skills.length > 0 && (
          <>
            <Heading>SKILLS</Heading>
            {r.skills.map((g) => (
              <p key={g.group}>
                <span className="font-semibold text-white">{g.group}:</span> {g.items.join(', ')}
              </p>
            ))}
          </>
        )}
        {r.experience.length > 0 && (
          <>
            <Heading>EXPERIENCE</Heading>
            {r.experience.map((e, i) => (
              <div key={i} className="mb-3">
                <p className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-white">{[e.title, e.company].filter(Boolean).join(' - ')}</span>
                  <span className="font-mono text-[11px] text-dim">{e.dates}</span>
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {e.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
        {r.projects.length > 0 && (
          <>
            <Heading>PROJECTS</Heading>
            {r.projects.map((p, i) => (
              <div key={i} className="mb-3">
                <p className="font-semibold text-white">
                  {p.name}
                  {p.stack && <span className="font-normal text-dim"> · {p.stack}</span>}
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {p.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
        {r.education.length > 0 && (
          <>
            <Heading>EDUCATION</Heading>
            {r.education.map((e, i) => (
              <p key={i}>
                <span className="font-semibold text-white">{[e.degree, e.school].filter(Boolean).join(' - ')}</span>
                {e.dates && <span className="font-mono text-[11px] text-dim"> · {e.dates}</span>}
              </p>
            ))}
          </>
        )}
      </article>

      <aside className="space-y-6">
        <a
          href={`/api/overclock/${view.id}/pdf`}
          className="block bg-phosphor py-3 text-center font-mono text-xs font-bold tracking-[0.25em] text-black shadow-[0_0_20px_rgba(0,255,65,0.3)] transition-colors hover:bg-[#33FF66]"
        >
          ⬇ DOWNLOAD PDF
        </a>
        <section>
          <Heading>WHAT CHANGED</Heading>
          <ul className="space-y-1.5 text-sm text-dim">
            {view.changes.map((c, i) => (
              <li key={i}>
                <span className="text-phosphor">+ </span>
                {c}
              </li>
            ))}
          </ul>
        </section>
        {view.gaps.length > 0 && (
          <section>
            <Heading>STILL MISSING (NOT ADDED)</Heading>
            <ul className="space-y-2.5 text-sm">
              {view.gaps.map((g, i) => (
                <li key={i}>
                  <p className="font-mono text-xs font-bold text-hud-amber">{g.requirement}</p>
                  <p className="text-dim">{g.advice}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {view.cover_note && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <Heading>COVER NOTE</Heading>
              <CopyButton value={view.cover_note} />
            </div>
            <p className="border-l-2 border-phosphor/40 pl-3 text-sm text-ink/90">{view.cover_note}</p>
          </section>
        )}
      </aside>
    </div>
  );
}

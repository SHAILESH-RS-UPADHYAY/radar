'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RadarLogo } from '@/components/brand/RadarLogo';
import { DiscoveryCard } from '@/components/dashboard/DiscoveryCard';
import { SAMPLE } from '@/components/site/sample-match';
import { LOOKS, readLook, saveLook, type Look } from '@/lib/looks';
import { LookDial } from './LookDial';

const choiceOf = (l: Look) => ({ id: l.id, light: l.mode === 'light' });
const noop = () => {};
const current = () => {
  const now = readLook();
  return Math.max(
    0,
    LOOKS.findIndex((l) => l.id === now.id && !!l.mode === (now.id === 'radar' && now.light)),
  );
};

/**
 * The first thing a new visitor sees: pick a look by turning a dial. The look under the notch is worn at once, and
 * one real match card shows what the product itself looks like in it.
 */
export function LookFirst({ onDone }: { onDone: () => void }) {
  // Client-only (loaded with next/dynamic), so the stored look can be read on the first render.
  const [came] = useState(current);
  const [at, setAt] = useState(came);
  const look = LOOKS[at];
  const body = useRef<HTMLElement>(null);

  // Everything above the bezel must fit above it on any screen: when it would not, the whole block shrinks until it
  // does (where the bezel is hidden, on phones and short screens, the page simply scrolls).
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const fit = () => {
      el.style.transform = '';
      const arc = document.querySelector<HTMLElement>('.bf-arc');
      if (!arc || getComputedStyle(arc).display === 'none') return;
      const top = arc.getBoundingClientRect().top - 24; // keep the notch clear too
      let bottom = 0;
      for (const child of el.children) bottom = Math.max(bottom, child.getBoundingClientRect().bottom);
      const r = el.getBoundingClientRect();
      const scale = (top - r.top) / (bottom - r.top);
      if (scale < 1) el.style.transform = `scale(${Math.max(0.5, scale)})`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  return (
    <div className="bf bf-look relative flex min-h-dvh flex-col overflow-x-clip bg-void text-ink">
      <div className="hud-grid pointer-events-none fixed inset-0" aria-hidden="true" />

      <header className="relative z-10 mx-auto flex w-full max-w-[1360px] items-center justify-between gap-3 px-4 pt-4 sm:px-10 sm:pt-6">
        <Link
          href="/"
          aria-label="RADAR home"
          className="inline-flex min-h-11 items-center transition-opacity hover:opacity-85"
        >
          <RadarLogo />
        </Link>
        <button
          type="button"
          onClick={() => {
            saveLook(choiceOf(look));
            onDone();
          }}
          className="bf-quiet"
        >
          Skip, keep {look.name}
        </button>
      </header>

      <main ref={body} className="bf-look-body relative z-10 mx-auto w-full max-w-[1360px] flex-1 px-4 pb-10 sm:px-10">
        <div className="bf-look-text min-w-0">
          <h1 className="bf-look-h1 font-display">First, choose your look.</h1>
          <p
            key={look.name}
            aria-live="polite"
            className="bf-look-name"
            style={{ fontFamily: look.font ? `var(${look.font}), sans-serif` : 'var(--font-jetbrains), monospace' }}
          >
            {look.name}
          </p>
          <p className="bf-look-line">{look.line}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <button
              type="button"
              onClick={() => {
                saveLook(choiceOf(look));
                onDone();
              }}
              className="bf-btn bg-phosphor font-bold text-black hover:bg-phosphor-hi"
            >
              Wear this one
            </button>
            <p className="bf-look-aside bf-soft text-sm">
              Same jobs, same tools, a different room. You can change it any time in Preferences.
            </p>
          </div>
        </div>

        <LookDial arc start={came} onTurn={setAt} onLook={(i) => saveLook(choiceOf(LOOKS[i]))} />

        {/* The real Discovery card with a made-up match: what the product looks like in this look. */}
        <div className="bf-look-sample" aria-hidden inert>
          <p className="bf-note mb-3">A sample match, as it looks in this room</p>
          <DiscoveryCard key={look.name} match={SAMPLE} onAction={noop} onInfiltrate={noop} onHack={noop} />
        </div>
      </main>
    </div>
  );
}

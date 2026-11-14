'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';

// First-run tour of the dashboard: a spotlight on one control at a time. Starts by itself the first time an account
// opens the dashboard in this browser, and from /dashboard?tour=1 (onboarding's last button, "Replay the tour" in
// Preferences). It waits while `hold` is true (a scan on screen). A stop whose control is not on screen is skipped.
const STOPS: { target: string; title: string; text: string }[] = [
  {
    target: 'tabs',
    title: 'Your four rooms',
    text: 'DISCOVERY shows new matches. THE VAULT keeps the strong ones. OVERCLOCK tailors your resume to one job. C2 · OPS tracks what you applied to.',
  },
  {
    target: 'scan',
    title: 'Scan now',
    text: 'Scores every open job against your profile. RADAR also runs this by itself every 6 hours.',
  },
  {
    target: 'zeroday',
    title: 'Zero-Day',
    text: "Lines up today's best jobs and fills the forms one after another. You always press Submit yourself.",
  },
  {
    target: 'prefs',
    title: 'Preferences',
    text: 'Roles, cities, Gmail, the extension and your look all live here. Change them any time.',
  },
];

const find = (target: string) => {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  const r = el?.getBoundingClientRect();
  return r && r.width > 0 ? r : null;
};

export function Tour({ hold = false }: { hold?: boolean }) {
  const { isLoaded, userId } = useAuth();
  const [at, setAt] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const decided = useRef(false);

  useEffect(() => {
    if (!isLoaded || hold || decided.current) return;
    decided.current = true;
    const q = new URLSearchParams(location.search);
    let wanted = q.get('tour') === '1';
    if (wanted) {
      q.delete('tour');
      history.replaceState(null, '', location.pathname + (q.size ? '?' + q : ''));
    }
    if (userId)
      try {
        const seen = 'radar:tour-seen:' + userId;
        if (!localStorage.getItem(seen)) wanted = true;
        localStorage.setItem(seen, '1');
      } catch {
        // storage blocked: the tour still runs from ?tour=1
      }
    if (!wanted) return;
    const start = setTimeout(() => setAt(0), 600); // let the dashboard settle first
    return () => clearTimeout(start);
  }, [isLoaded, userId, hold]);

  const go = useCallback((from: number) => {
    let i = from;
    while (i < STOPS.length && !find(STOPS[i].target)) i++;
    setAt(i < STOPS.length ? i : -1);
  }, []);

  useEffect(() => {
    if (at < 0) return;
    const place = () => {
      const r = find(STOPS[at].target);
      if (r) setRect(r);
      else go(at + 1);
    };
    place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAt(-1);
      if (e.key === 'ArrowRight') go(at + 1);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [at, go]);

  if (at < 0 || !rect) return null;
  const stop = STOPS[at];
  const last = !STOPS.slice(at + 1).some((s) => find(s.target));
  const pad = 6;
  const cardW = Math.min(340, window.innerWidth - 24);
  const left = Math.max(12, Math.min(rect.left + rect.width / 2 - cardW / 2, window.innerWidth - cardW - 12));

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={'Tour: ' + stop.title}>
      {/* The spotlight: a hole whose shadow dims everything else. */}
      <div
        className="pointer-events-none absolute border border-phosphor transition-all duration-300"
        style={{
          left: rect.left - pad,
          top: rect.top - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: '0 0 0 200vmax rgb(0 0 0 / 0.72), 0 0 24px rgb(var(--glow) / 0.5)',
        }}
      />
      <div
        className="hud-panel absolute border border-phosphor/60 bg-black p-5 transition-all duration-300"
        style={{ left, top: rect.bottom + pad + 14, width: cardW }}
      >
        <p className="font-mono text-[10px] tracking-[0.3em] text-phosphor/70">
          TOUR {at + 1}/{STOPS.length}
        </p>
        <h2 className="mt-2 font-mono text-lg font-extrabold text-white">{stop.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-dim">{stop.text}</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setAt(-1)}
            className="font-mono text-[11px] tracking-[0.2em] text-dim transition-colors hover:text-phosphor"
          >
            SKIP
          </button>
          <button
            autoFocus
            onClick={() => go(at + 1)}
            className="bg-phosphor px-5 py-2 font-mono text-[11px] font-bold tracking-[0.2em] text-black transition-colors hover:bg-phosphor-hi"
          >
            {last ? 'DONE' : 'NEXT →'}
          </button>
        </div>
      </div>
    </div>
  );
}

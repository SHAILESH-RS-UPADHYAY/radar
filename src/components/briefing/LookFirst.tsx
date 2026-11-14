'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import Link from 'next/link';
import { RadarLogo } from '@/components/brand/RadarLogo';
import { DiscoveryCard } from '@/components/dashboard/DiscoveryCard';
import { SAMPLE } from '@/components/site/sample-match';
import { LOOKS, readLook, saveLook, switchLook, type Look } from '@/lib/looks';

const N = LOOKS.length;
const STEP = 360 / N;
const mod = (n: number) => ((n % N) + N) % N;
const choiceOf = (l: Look) => ({ id: l.id, light: l.mode === 'light' });
const noop = () => {};

/**
 * The first thing a new visitor sees: RADAR's watch bezel, grown until only its top arc fits on screen, with one bead
 * per look. Turn it (drag, arrow keys, tap a bead) and the whole screen changes room; the bead under the notch is worn.
 * Beside it, one real match card shows what the product itself looks like in that room.
 */
export function LookFirst({ onDone }: { onDone: () => void }) {
  // `pos` only ever counts up or down, so the dial takes the short way round past the last bead.
  const [pos, setPos] = useState(0);
  // The look this browser arrived in: what "Skip" goes back to (RADAR on a first visit).
  const [came, setCame] = useState(LOOKS[0]);
  const dial = useRef<HTMLDivElement>(null);
  const beads = useRef<(HTMLButtonElement | null)[]>([]);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const busy = useRef(false);
  const calm = useRef<ReturnType<typeof setTimeout>>(undefined);
  const at = mod(pos);
  const look = LOOKS[at];

  useEffect(() => {
    const sync = () => {
      const now = readLook();
      const i = LOOKS.findIndex((l) => l.id === now.id && !!l.mode === (now.id === 'radar' && now.light));
      if (i > 0) {
        setPos(i);
        setCame(LOOKS[i]);
      }
    };
    sync();
  }, []);

  const turnTo = (next: number, focus = false) => {
    const choice = choiceOf(LOOKS[mod(next)]);
    setPos(next);
    // A held key or a fast drag turns the dial many times a second: only a settled turn gets the opening circle,
    // which starts at the notch on top of the dial.
    if (busy.current) saveLook(choice);
    else switchLook(choice, innerWidth / 2, (dial.current?.getBoundingClientRect().top ?? innerHeight - 184) + 60);
    busy.current = true;
    clearTimeout(calm.current);
    calm.current = setTimeout(() => (busy.current = false), 400);
    if (focus) beads.current[mod(next)]?.focus({ preventScroll: true });
  };
  const pick = (i: number) => {
    let d = i - at;
    if (d > N / 2) d -= N;
    if (d < -N / 2) d += N;
    if (d) turnTo(pos + d);
  };

  const onKey = (e: KeyboardEvent) => {
    const d =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    turnTo(pos + d, true);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) < 56) return;
    drag.current = { x: e.clientX, moved: true };
    turnTo(pos + (dx < 0 ? 1 : -1));
  };

  return (
    <div className="bf bf-look relative flex h-dvh min-h-[35rem] flex-col overflow-hidden bg-void text-ink">
      <div className="hud-grid pointer-events-none absolute inset-0" aria-hidden="true" />

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
            saveLook(choiceOf(came));
            onDone();
          }}
          className="bf-quiet"
        >
          Skip, keep {came.name}
        </button>
      </header>

      <div className="bf-look-body relative z-10 mx-auto w-full max-w-[1360px] px-4 sm:px-10">
        <div className="min-w-0">
          <h1 className="bf-look-h1 font-display">First, choose your look.</h1>
          <p className="bf-note mt-4 tabular-nums">
            {String(at + 1).padStart(2, '0')} / {N}
          </p>
          <p
            key={look.name}
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

        {/* The real Discovery card with a made-up match: what the product looks like in this look. */}
        <div className="bf-look-sample" aria-hidden inert>
          <p className="bf-note mb-3">A sample match, as it looks in this room</p>
          <DiscoveryCard key={look.name} match={SAMPLE} onAction={noop} onInfiltrate={noop} onHack={noop} />
        </div>
      </div>

      {/* The dial. radar-native: it is RADAR's own instrument and its beads are fixed swatches; no look restyles it. */}
      <div
        ref={dial}
        className="bf-dial radar-native"
        onPointerDown={(e) => (drag.current = { x: e.clientX, moved: false })}
        onPointerMove={onMove}
        onPointerUp={() => setTimeout(() => (drag.current = null))}
        onPointerLeave={() => (drag.current = null)}
      >
        <span className="bf-dial-notch" aria-hidden />
        <div
          role="radiogroup"
          aria-label="Look. The arrow keys turn the dial."
          className="bf-dial-turn"
          style={{ transform: `rotate(${-pos * STEP}deg)` }}
          onKeyDown={onKey}
        >
          <span className="bf-dial-ticks" aria-hidden />
          {LOOKS.map((l, i) => {
            const [page, card, accent, ink] = l.swatch;
            const on = i === at;
            return (
              <span key={l.name} className="bf-bead" style={{ transform: `rotate(${i * STEP}deg)` }}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${l.name}. ${l.line}`}
                  tabIndex={on ? 0 : -1}
                  ref={(el) => {
                    beads.current[i] = el;
                  }}
                  onClick={() => !drag.current?.moved && pick(i)}
                  style={{ background: page, color: accent, boxShadow: on ? `0 0 0 3px ${accent}` : undefined }}
                >
                  <span style={{ background: card, borderColor: accent }}>
                    <i style={{ background: ink }} />
                    <i style={{ background: accent }} />
                  </span>
                </button>
              </span>
            );
          })}
        </div>
        <p className="bf-dial-cap">
          Drag the dial or tap a bead.<span className="bf-keys-only"> The arrow keys turn it too.</span>
        </p>
      </div>
    </div>
  );
}

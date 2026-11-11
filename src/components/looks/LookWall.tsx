'use client';

import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { LOOKS, onLookChange, readLook, switchLook, type Look, type LookChoice } from '@/lib/looks';

/**
 * The home page's look switcher: a row of postcards, one per look, each drawn in its own colours and set in its own
 * type. Pick one and the whole site opens into it from the card you touched.
 */
export function LookWall() {
  const [now, setNow] = useState<LookChoice>({ id: 'radar', light: false });
  useEffect(() => {
    const sync = () => setNow(readLook());
    sync();
    return onLookChange(sync);
  }, []);
  const isOn = (l: Look) => l.id === now.id && !!l.mode === (now.id === 'radar' && now.light);

  const pick = (l: Look, el: HTMLElement, x?: number, y?: number) => {
    const r = el.getBoundingClientRect();
    switchLook({ id: l.id, light: l.mode === 'light' }, x || r.left + r.width / 2, y || r.top + r.height / 2);
  };

  return (
    // radar-native: the cards are fixed swatches; no look may restyle them.
    <div
      role="radiogroup"
      aria-label="Look"
      className="radar-native look-wall -mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-8 pt-6 sm:-mx-6 sm:px-6"
    >
      {LOOKS.map((l, i) => {
        const on = isOn(l);
        const [page, card, accent, ink] = l.swatch;
        return (
          <div
            key={l.name}
            role="radio"
            aria-checked={on}
            aria-label={`${l.name}. ${l.line}`}
            tabIndex={0}
            onClick={(e: MouseEvent<HTMLDivElement>) => pick(l, e.currentTarget, e.clientX, e.clientY)}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              pick(l, e.currentTarget);
            }}
            className="look-card relative flex h-72 w-52 shrink-0 cursor-pointer snap-center flex-col overflow-hidden p-4 outline-none"
            style={{
              background: page,
              color: ink,
              borderRadius: 14,
              rotate: `${i % 2 ? 1.6 : -1.6}deg`,
              boxShadow: on
                ? `0 0 0 3px ${accent}, 0 24px 50px -18px ${accent}`
                : '0 0 0 1px rgb(128 128 128 / 0.35), 0 18px 40px -22px rgb(0 0 0 / 0.6)',
            }}
          >
            {/* A tiny screen of the app in this look. */}
            <span aria-hidden="true" className="flex items-center justify-between">
              <span className="h-1.5 w-9" style={{ background: accent, borderRadius: 2 }} />
              <span className="h-3 w-3 rounded-full" style={{ border: `2px solid ${accent}` }} />
            </span>
            <span
              aria-hidden="true"
              className="mt-3 flex flex-1 flex-col justify-between p-3"
              style={{ background: card, borderRadius: 8, border: `1px solid ${accent}66` }}
            >
              <span className="space-y-1.5">
                <span className="block h-1.5 w-4/5" style={{ background: ink, opacity: 0.85 }} />
                <span className="block h-1.5 w-3/5" style={{ background: ink, opacity: 0.45 }} />
                <span className="block h-1.5 w-2/5" style={{ background: ink, opacity: 0.25 }} />
              </span>
              <span className="flex items-end justify-between">
                <span className="text-2xl font-black leading-none" style={{ color: accent }}>
                  92
                </span>
                <span className="h-4 w-12" style={{ background: accent, borderRadius: 3 }} />
              </span>
            </span>
            <span
              className="mt-3 block text-2xl font-bold leading-none"
              style={{ fontFamily: l.font ? `var(${l.font}), sans-serif` : 'var(--font-jetbrains), monospace' }}
            >
              {l.name}
            </span>
            <span className="mt-1.5 block text-[11px] leading-snug" style={{ opacity: 0.75 }}>
              {l.line}
            </span>
            {on && (
              <span
                className="absolute right-3 top-9 px-1.5 py-0.5 text-[9px] font-bold tracking-widest"
                style={{ background: accent, color: page, borderRadius: 3, rotate: '6deg' }}
              >
                WORN NOW
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

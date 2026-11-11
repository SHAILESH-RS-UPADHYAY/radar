'use client';

import { useEffect, useState } from 'react';
import { HudPanel } from '@/components/hud/Hud';
import { LOOKS, onLookChange, readLook, switchLook, type LookChoice } from '@/lib/looks';

/**
 * CONFIG://LOOK — how RADAR looks on this device. RADAR (the original) is the default; the others re-skin the whole
 * product at once. Each tile is drawn in its own colours, so it shows what you get before you pick it.
 */
export function LookPicker() {
  const [now, setNow] = useState<LookChoice>({ id: 'radar', light: false });
  useEffect(() => {
    const sync = () => setNow(readLook());
    sync();
    return onLookChange(sync);
  }, []);
  const current = LOOKS.find((l) => l.id === now.id && !!l.mode === (now.id === 'radar' && now.light));

  return (
    <HudPanel
      id="look"
      label="CONFIG://LOOK"
      status={current?.name}
      tone="info"
      className="min-w-0 scroll-mt-24 xl:col-span-2"
    >
      <p className="-mt-1 mb-5 text-sm leading-relaxed text-dim">
        Pick how RADAR looks on this device. Nothing else changes: same jobs, same tools, a different room.
      </p>
      <div role="radiogroup" aria-label="Look" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {LOOKS.map((l) => {
          const on = l === current;
          const [page, card, accent, ink] = l.swatch;
          return (
            <button
              key={l.name}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={(e) => switchLook({ id: l.id, light: l.mode === 'light' }, e.clientX, e.clientY)}
              className={
                'group border p-2 text-left transition-colors ' +
                (on ? 'border-phosphor bg-phosphor/10' : 'border-phosphor/20 hover:border-phosphor/60')
              }
            >
              {/* A tiny dashboard in the look's own colours (fixed values on purpose: it must not follow the current look). */}
              <span
                aria-hidden="true"
                className="radar-native flex h-20 flex-col gap-1.5 overflow-hidden p-2"
                style={{ background: page, borderRadius: 6 }}
              >
                <span className="h-1.5 w-10" style={{ background: accent, borderRadius: 2 }} />
                <span
                  className="flex flex-1 items-center gap-2 px-2"
                  style={{ background: card, borderRadius: 4, border: `1px solid ${accent}55` }}
                >
                  <span className="flex-1 space-y-1">
                    <span className="block h-1 w-4/5" style={{ background: ink, opacity: 0.85 }} />
                    <span className="block h-1 w-1/2" style={{ background: ink, opacity: 0.4 }} />
                  </span>
                  <span className="h-3 w-7" style={{ background: accent, borderRadius: 2 }} />
                </span>
              </span>
              <span className="mt-2 block font-mono text-[11px] font-bold tracking-[0.18em] text-phosphor">
                {on ? '● ' : ''}
                {l.name}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-dim">{l.line}</span>
            </button>
          );
        })}
      </div>
    </HudPanel>
  );
}

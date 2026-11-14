'use client';

import { useEffect, useRef, useState } from 'react';
import { LOOKS, readLook, saveLook } from '@/lib/looks';
import { LookDial } from '@/components/briefing/LookDial';

const now = () => {
  const c = readLook();
  return Math.max(
    0,
    LOOKS.findIndex((l) => l.id === c.id && !!l.mode === (c.id === 'radar' && c.light)),
  );
};

/** The look dial over any page: turn it and the page behind changes as you go. Esc or Done closes it. */
export function LookDialSheet({ onClose }: { onClose: () => void }) {
  const [start] = useState(now);
  const [at, setAt] = useState(start);
  const done = useRef<HTMLButtonElement>(null);
  const look = LOOKS[at];

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.querySelector<HTMLElement>('.bf-crown')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="look-sheet fixed inset-0 z-[80] grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose your look"
    >
      <button type="button" aria-label="Close" className="look-sheet-scrim absolute inset-0" onClick={onClose} />
      <div className="look-sheet-panel relative grid justify-items-center gap-4 px-6 pb-6 pt-7">
        <p
          key={look.name}
          className="bf-look-name text-center"
          style={{ fontFamily: look.font ? `var(${look.font}), sans-serif` : 'var(--font-jetbrains), monospace' }}
        >
          {look.name}
        </p>
        <p className="max-w-[28ch] text-center text-sm leading-snug">{look.line}</p>
        <LookDial
          start={start}
          onTurn={setAt}
          onLook={(i) => saveLook({ id: LOOKS[i].id, light: LOOKS[i].mode === 'light' })}
        />
        <button
          ref={done}
          type="button"
          onClick={onClose}
          className="bf-btn bg-phosphor font-bold text-black hover:bg-phosphor-hi"
        >
          Done
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

/** Copies `value` to the clipboard and confirms for a moment. */
export function CopyButton({ value, label = 'COPY' }: { value: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  return (
    <button
      type="button"
      disabled={!value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState('done');
        } catch {
          setState('failed');
        }
        setTimeout(() => setState('idle'), 1500);
      }}
      className="shrink-0 border border-phosphor/30 px-2 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-phosphor transition-colors hover:bg-phosphor/10 disabled:opacity-30"
    >
      {state === 'done' ? 'COPIED ✓' : state === 'failed' ? 'COPY FAILED' : label}
    </button>
  );
}

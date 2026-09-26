'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type Notice = { tone: 'ok' | 'info' | 'alert'; text: string; action?: { label: string; run: () => void } };

const TONE = {
  ok: { box: 'border-phosphor/60', tag: 'text-phosphor', label: 'OK' },
  info: { box: 'border-hud-cyan/60', tag: 'text-hud-cyan', label: 'SYS' },
  alert: { box: 'border-hud-red/70', tag: 'text-hud-red', label: 'ERR' },
};

/** Bottom-right status toast. Success/info fade out on their own; errors stay until dismissed. */
export function Toast({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  useEffect(() => {
    if (!notice || notice.tone === 'alert') return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [notice, onClose]);

  const tone = notice ? TONE[notice.tone] : TONE.ok;
  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          key={notice.text}
          role={notice.tone === 'alert' ? 'alert' : 'status'}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className={
            'fixed bottom-5 left-4 right-4 z-[60] border bg-black/95 px-4 py-3 font-mono text-xs shadow-[0_0_30px_rgba(0,0,0,0.6)] backdrop-blur sm:left-auto sm:max-w-sm ' +
            tone.box
          }
        >
          <div className="flex items-start gap-3">
            <span className={'shrink-0 font-bold tracking-[0.2em] ' + tone.tag}>[{tone.label}]</span>
            <p className="flex-1 leading-relaxed text-ink">{notice.text}</p>
            <button
              onClick={onClose}
              aria-label="Dismiss"
              className="shrink-0 text-dim transition-colors hover:text-white"
            >
              ×
            </button>
          </div>
          {notice.action && (
            <button
              onClick={() => {
                notice.action?.run();
                onClose();
              }}
              className={'mt-2 ml-[3.25rem] font-bold tracking-[0.2em] hover:underline ' + tone.tag}
            >
              {notice.action.label} →
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

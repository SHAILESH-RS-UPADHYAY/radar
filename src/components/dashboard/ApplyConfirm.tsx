'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Modal } from '@/components/hud/Modal';
import { Decrypt } from '@/components/hud/Decrypt';
import type { MatchedJob } from './types';

// Scatter that looks random but is the same on every render (render must stay pure).
const noise = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
};

/** Each letter flies in from somewhere else on screen and locks into the line. */
function Assemble({ text, className }: { text: string; className?: string }) {
  const still = useReducedMotion();
  return (
    <span aria-label={text} className={className}>
      {[...text].map((ch, i) =>
        ch === ' ' ? (
          ' '
        ) : (
          <motion.span
            key={i}
            aria-hidden
            className="inline-block"
            initial={
              still ? false : { x: noise(i, 1) * 180, y: noise(i, 2) * 110, rotate: noise(i, 3) * 60, opacity: 0 }
            }
            animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 20, delay: 0.05 + i * 0.014 }}
          >
            {ch}
          </motion.span>
        ),
      )}
    </span>
  );
}

/** Letters drop from above and bounce into place: the hack went through. */
function Drop({ text, className }: { text: string; className?: string }) {
  const still = useReducedMotion();
  return (
    <span aria-label={text} className={className}>
      {[...text].map((ch, i) =>
        ch === ' ' ? (
          ' '
        ) : (
          <motion.span
            key={i}
            aria-hidden
            className="inline-block"
            initial={still ? false : { y: -140 - noise(i, 4) * 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 16, delay: i * 0.035 }}
          >
            {ch}
          </motion.span>
        ),
      )}
    </span>
  );
}

/**
 * APPLY://CONFIRM — opening an apply link is not applying. RADAR asks when you are back, and only a yes moves the
 * job to C2 · OPS (then the confirmation drops in and the dialog closes itself).
 */
export function ApplyConfirm({
  match,
  onApplied,
  onKeep,
  onClose,
}: {
  match: MatchedJob;
  onApplied: () => void;
  /** "Not yet" on a Discovery job keeps it in the Vault. */
  onKeep: () => void;
  onClose: () => void;
}) {
  const [done, setDone] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inDiscovery = match.status === 'new';

  const yes = () => {
    if (done) return;
    setDone(true);
    onApplied();
    closeTimer.current = setTimeout(onClose, 1900);
  };
  const no = () => {
    if (inDiscovery) onKeep();
    onClose();
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Y / N answer from the keyboard.
  const keys = useRef({ yes, no });
  useEffect(() => {
    keys.current = { yes, no };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'y') keys.current.yes();
      if (e.key.toLowerCase() === 'n') keys.current.no();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Modal
      open
      onClose={onClose}
      label="APPLY://CONFIRM"
      status={<span className={done ? 'text-phosphor' : 'text-hud-amber'}>{done ? 'LOGGED' : 'AWAITING INPUT'}</span>}
    >
      {!done ? (
        <div className="py-2">
          <p className="font-mono text-[11px] tracking-[0.2em] text-dim">
            <span className="border border-phosphor/40 bg-phosphor/10 px-2 py-0.5 font-bold text-phosphor">
              {match.job.company.name.toUpperCase()}
            </span>{' '}
            <Decrypt text={match.job.title} className="text-white" />
          </p>
          <h2 className="mt-6 font-mono text-2xl font-extrabold leading-tight text-white sm:text-3xl">
            <Assemble text="Did the application go through?" />
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-dim">
            The company&apos;s page is open in another tab. Only you can press submit there, so tell RADAR how it went:
            a yes moves this job to C2 · OPS, where replies are tracked.
          </p>
          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={yes}
              className="flex items-center justify-center gap-3 bg-phosphor py-3 font-mono text-xs font-bold tracking-[0.25em] text-black shadow-[0_0_24px_rgba(0,255,65,0.35)] transition-colors hover:bg-[#33FF66]"
            >
              <kbd className="border border-black/30 px-1.5 text-[10px]">Y</kbd> YES, I APPLIED
            </button>
            <button
              type="button"
              onClick={no}
              className="flex items-center justify-center gap-3 border border-phosphor/40 py-3 font-mono text-xs font-bold tracking-[0.25em] text-phosphor transition-colors hover:bg-phosphor/10"
            >
              <kbd className="border border-phosphor/30 px-1.5 text-[10px]">N</kbd>
              {inDiscovery ? 'NOT YET · KEEP IN VAULT' : 'NOT YET'}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden py-6 text-center" role="status">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 h-px bg-phosphor shadow-[0_0_14px_#00FF41]"
            initial={{ top: '0%', opacity: 1 }}
            animate={{ top: '100%', opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeIn' }}
          />
          <p className="font-mono text-[10px] tracking-[0.4em] text-dim">ACCESS GRANTED</p>
          <Drop
            text="APPLICATION LOGGED"
            className="mt-3 block font-mono text-3xl font-extrabold tracking-wider text-phosphor [text-shadow:0_0_24px_rgba(0,255,65,0.55)] sm:text-4xl"
          />
          <p className="mt-5 font-mono text-xs text-phosphor/80">
            <Decrypt text={`▸ ${match.job.company.name} moved to C2 · OPS · RADAR now watches for the reply`} />
          </p>
          <motion.div
            className="mx-auto mt-6 h-0.5 bg-phosphor/70"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.8, ease: 'linear' }}
          />
        </div>
      )}
    </Modal>
  );
}

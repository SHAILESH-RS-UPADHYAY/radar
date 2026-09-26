'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brackets } from './Hud';

// Open dialogs, newest last: Esc closes only the one on top when a dialog opens another.
const stack: symbol[] = [];

/**
 * HUD dialog: closes on Esc or a backdrop click, takes focus when it opens and hands it back when it
 * closes, and stops the page behind it from scrolling.
 */
export function Modal({
  open,
  onClose,
  label,
  status,
  wide = false,
  variant = 'hud',
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  status?: ReactNode;
  wide?: boolean;
  /** 'terminal' = full screen, pure black, no frame: the children draw everything (the JD terminal). */
  variant?: 'hud' | 'terminal';
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const me = Symbol('modal');
    stack.push(me);
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === me) {
        e.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(me), 1);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && variant === 'terminal' && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22 }}
            className="relative flex h-[90vh] w-full flex-col overflow-hidden border border-[#303030] bg-black shadow-[0_30px_90px_rgba(0,0,0,0.9)] focus:outline-none sm:h-[84vh] sm:max-w-5xl sm:rounded-lg 2xl:max-w-6xl"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
      {open && variant === 'hud' && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2 }}
            className={
              'relative flex max-h-[92vh] w-full flex-col border border-phosphor/40 bg-void shadow-[0_0_60px_rgba(0,255,65,0.12)] focus:outline-none ' +
              (wide ? 'sm:max-w-4xl' : 'sm:max-w-2xl')
            }
          >
            <Brackets />
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-phosphor/20 px-5 py-3 font-mono text-[10px] tracking-[0.25em]">
              <span className="truncate text-phosphor/80">{label}</span>
              <span className="flex items-center gap-4">
                {status}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="text-dim transition-colors hover:text-white"
                >
                  [ESC] ×
                </button>
              </span>
            </div>
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

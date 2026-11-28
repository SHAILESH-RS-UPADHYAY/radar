'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import { applyLook, LOOK_BOOT, onLookChange, readLook } from '@/lib/looks';
import '@/app/looks.css';

// Typefaces for every look come from src/app/fonts.css (self-hosted; loaded only when a look uses them).

/**
 * Wraps every page (root layout): puts your look on <html> and keeps it in step with the picker and other tabs.
 */
export function LookRoot({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const sync = () => applyLook(readLook());
    sync();
    const off = onLookChange(sync);
    return off;
  }, []);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: LOOK_BOOT }} />
      {children}
    </>
  );
}

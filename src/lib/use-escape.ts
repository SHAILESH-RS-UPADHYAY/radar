'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Esc navigates to `href`, as the "[ESC]" labels promise. While typing, the first Esc only leaves
 * the field; with a dialog or menu open (e.g. Clerk's user menu) Esc is left to close it.
 * The target is prefetched so the jump is instant.
 */
export function useEscapeTo(href: string) {
  const router = useRouter();
  useEffect(() => {
    router.prefetch(href);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) {
        el.blur();
        return;
      }
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return;
      router.push(href);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [href, router]);
}

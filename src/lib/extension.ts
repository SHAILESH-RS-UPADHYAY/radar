'use client';

// The RADAR · Auto-Fill extension (extension/ in this repo) talks to this page through window.postMessage:
// extension/radar-bridge.js relays between the page and the extension. No token or session ever leaves the page.

import { useEffect, useState } from 'react';
import type { FillPacket } from '@/lib/apply/bridge';

export interface ExtensionEvent {
  type: 'pong' | 'launched' | 'filled' | 'applied';
  version?: string;
  matchId?: string;
  tailoredId?: string | null;
  ok?: boolean;
  error?: string;
  filled?: number;
  needs?: number;
}

const send = (message: Record<string, unknown>) =>
  window.postMessage({ radar: 'app', ...message }, window.location.origin);

/** Listen to the extension; returns the unsubscribe function. */
export function onExtension(listener: (event: ExtensionEvent) => void): () => void {
  const handle = (e: MessageEvent) => {
    if (e.source !== window || e.origin !== window.location.origin || e.data?.radar !== 'ext') return;
    listener(e.data as ExtensionEvent);
  };
  window.addEventListener('message', handle);
  return () => window.removeEventListener('message', handle);
}

/** The installed extension's version, or null when it is not installed (answers within a moment of mounting). */
export function useExtension(): string | null {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    const off = onExtension((e) => e.type === 'pong' && setVersion(e.version || 'installed'));
    send({ type: 'ping' });
    return off;
  }, []);
  return version;
}

/**
 * One click: the extension opens the form in a new tab at once. The answers can come with it, or a moment later
 * through armInExtension (the form loads while the AI drafts them).
 */
export function launchInExtension(launch: {
  url: string;
  matchId: string;
  tailoredId: string | null;
  packet?: FillPacket;
}) {
  send({ type: 'launch', ...launch });
}

/** The answers for a form launched without them, or why there are none (the form tab shows it). */
export function armInExtension(arm: {
  matchId: string;
  tailoredId?: string | null;
  packet?: FillPacket;
  error?: string;
}) {
  send({ type: 'arm', ...arm });
}

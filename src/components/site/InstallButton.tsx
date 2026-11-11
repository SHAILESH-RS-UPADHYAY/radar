'use client';

import { useEffect, useState } from 'react';

type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Chrome/Edge/Android's own install prompt, when the browser offers one; otherwise it says how to install. */
export function InstallButton() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [state, setState] = useState<'idle' | 'installed' | 'ios'>('idle');

  useEffect(() => {
    // Read once the page is in the browser (the server cannot know); deferred so it is not a render-time update.
    const sniff = setTimeout(() => {
      if (matchMedia('(display-mode: standalone)').matches) setState('installed');
      else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) setState('ios');
    }, 0);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as Prompt);
    };
    const onDone = () => setState('installed');
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onDone);
    return () => {
      clearTimeout(sniff);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onDone);
    };
  }, []);

  if (state === 'installed')
    return (
      <p className="font-mono text-xs font-bold tracking-[0.2em] text-phosphor">● RADAR IS INSTALLED ON THIS DEVICE</p>
    );
  if (state === 'ios')
    return (
      <p className="text-sm text-dim">
        On iPhone or iPad: open this page in Safari, tap <b className="text-ink">Share</b>, then{' '}
        <b className="text-ink">Add to Home Screen</b>.
      </p>
    );
  if (!prompt)
    return (
      <p className="text-sm text-dim">
        In Chrome or Edge, use the install icon at the right end of the address bar, or the menu →{' '}
        <b className="text-ink">Install RADAR</b>. On Android: menu → <b className="text-ink">Add to Home screen</b>.
      </p>
    );
  return (
    <button
      onClick={async () => {
        await prompt.prompt();
        if ((await prompt.userChoice).outcome === 'accepted') setState('installed');
        setPrompt(null);
      }}
      className="bg-phosphor px-6 py-3 font-mono text-xs font-bold tracking-[0.25em] text-black transition-colors hover:bg-phosphor-hi"
    >
      ⤓ INSTALL RADAR
    </button>
  );
}

/** Registers the offline-page service worker. Rendered once, from the root layout. */
export function ServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator && location.protocol === 'https:')
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
  }, []);
  return null;
}

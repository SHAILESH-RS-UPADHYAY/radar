'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { primaryAction, secondaryAction, StatusScreen } from '@/components/hud/StatusScreen';

// Catches render errors in any page below the root layout; the header/nav of that page is replaced by this screen.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[APP]', error);
    // A tab opened before a deploy asks for script files the new deploy no longer has. A fresh load fixes that, so
    // do it once by itself (the flag stops a loop if the reload does not help).
    const stale = /ChunkLoadError|Loading chunk|dynamically imported module|Failed to load chunk/i.test(
      error.name + ' ' + error.message,
    );
    try {
      if (stale && !sessionStorage.getItem('radar_reloaded')) {
        sessionStorage.setItem('radar_reloaded', '1');
        window.location.reload();
      }
    } catch {
      // storage blocked: the screen below stays, with its Retry button
    }
  }, [error]);

  return (
    <StatusScreen
      code={
        'ERR 500 · SYSTEM FAULT' +
        (error.digest ? ' · ' + error.digest : error.name !== 'Error' ? ' · ' + error.name : '')
      }
      title="SIGNAL DROPPED"
      body="Something failed while loading this screen. Your data is safe, and retrying usually fixes it."
    >
      <button type="button" onClick={() => unstable_retry()} className={primaryAction}>
        [ RETRY ]
      </button>
      <Link href="/" className={secondaryAction}>
        ./home
      </Link>
    </StatusScreen>
  );
}

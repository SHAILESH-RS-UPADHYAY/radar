'use client';

import { useEffect } from 'react';
import './globals.css';
import { primaryAction, StatusScreen } from '@/components/hud/StatusScreen';

// Last line of defence: replaces the root layout itself, so it brings its own <html> and <body>.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[APP:GLOBAL]', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <title>System fault · RADAR</title>
        <StatusScreen
          code={'ERR 500 · CORE FAULT' + (error.digest ? ' · ' + error.digest : '')}
          title="SYSTEM HALTED"
          body="RADAR hit an unexpected error while starting up. Retry, and if it keeps happening, check back in a few minutes."
        >
          <button type="button" onClick={() => unstable_retry()} className={primaryAction}>
            [ REBOOT ]
          </button>
        </StatusScreen>
      </body>
    </html>
  );
}

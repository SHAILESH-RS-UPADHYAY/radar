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
  }, [error]);

  return (
    <StatusScreen
      code={'ERR 500 · SYSTEM FAULT' + (error.digest ? ' · ' + error.digest : '')}
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

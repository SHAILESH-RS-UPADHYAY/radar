import type { Metadata } from 'next';
import Link from 'next/link';
import { primaryAction, secondaryAction, StatusScreen } from '@/components/hud/StatusScreen';

export const metadata: Metadata = { title: 'Signal lost' };

export default function NotFound() {
  return (
    <StatusScreen
      code="ERR 404 · SIGNAL LOST"
      title="OFF RADAR"
      body="Nothing is transmitting on this frequency. The page may have moved, or the link is mistyped."
    >
      <Link href="/" className={primaryAction}>
        [ RETURN TO BASE ]
      </Link>
      <Link href="/dashboard" className={secondaryAction}>
        ./dashboard
      </Link>
    </StatusScreen>
  );
}

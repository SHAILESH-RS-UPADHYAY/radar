import type { ReactNode } from 'react';
import { LookRoot } from '@/components/looks/LookRoot';

// The signed-in app (dashboard, Preferences, onboarding, ZERO-DAY) wears the look you picked.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <LookRoot>{children}</LookRoot>;
}

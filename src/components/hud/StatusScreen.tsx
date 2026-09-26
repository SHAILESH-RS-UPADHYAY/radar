import type { ReactNode } from 'react';
import Link from 'next/link';
import { RadarLogo } from '@/components/brand/RadarLogo';

export const primaryAction =
  'bg-phosphor px-8 py-3.5 font-mono text-xs font-bold tracking-[0.25em] text-black shadow-[0_0_25px_rgba(0,255,65,0.35)] transition-colors hover:bg-[#33FF66]';
export const secondaryAction =
  'border border-phosphor/50 px-8 py-3.5 font-mono text-xs font-bold tracking-[0.25em] text-phosphor transition-colors hover:bg-phosphor/10';

/** Full-screen HUD message for 404s and crashes. */
export function StatusScreen({
  code,
  title,
  body,
  children,
}: {
  code: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-void px-4 py-16 text-center">
      <div className="hud-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,65,0.09),transparent_60%)]"
        aria-hidden="true"
      />
      <div className="relative">
        <Link href="/" aria-label="RADAR home" className="inline-block">
          <RadarLogo size="lg" />
        </Link>
        <p className="mt-14 font-mono text-[11px] tracking-[0.35em] text-hud-amber">{code}</p>
        <h1
          className="glitch mt-4 font-mono text-5xl font-extrabold tracking-tight text-white sm:text-7xl"
          data-text={title}
        >
          {title}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-dim sm:text-base">{body}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">{children}</div>
      </div>
    </main>
  );
}

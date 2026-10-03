import { RadarLogo } from '@/components/brand/RadarLogo';

// Shown the instant you open the dashboard, Preferences or onboarding, while the page loads behind it. These pages are
// signed-in only, so every click waits on a server round trip; without this it looks as if the click did nothing.
export default function Loading() {
  return (
    <div className="relative min-h-screen bg-void" aria-busy="true">
      <div className="hud-grid pointer-events-none fixed inset-0" aria-hidden="true" />
      <header className="sticky top-0 z-40 border-b border-phosphor/15 bg-black/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <RadarLogo />
          <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-phosphor/80">
            <span
              aria-hidden="true"
              className="h-3 w-3 animate-spin rounded-full border border-phosphor bg-[conic-gradient(from_0deg,rgba(0,255,65,0.85),transparent_30%)]"
            />
            LOADING
          </p>
        </div>
      </header>
      <main className="relative mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        <div className="h-3 w-32 animate-pulse bg-phosphor/20" />
        <div className="mt-3 h-8 w-64 max-w-full animate-pulse bg-phosphor/10" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:gap-8">
          <div className="hidden h-96 animate-pulse border border-phosphor/10 bg-phosphor/[0.03] lg:block" />
          <div className="grid gap-6 xl:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-56 animate-pulse border border-phosphor/10 bg-phosphor/[0.03]" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

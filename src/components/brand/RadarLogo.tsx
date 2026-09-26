// RADAR brand: a HUD-framed radar scope. Pure SVG, no ids, so it can render any number of times
// per page (and in server components). The sweep fades in three layered wedges instead of a gradient.

export function RadarMark({ className = 'h-8 w-8', animated = true }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M1.5 8V1.5H8M24 1.5h6.5V8M30.5 24v6.5H24M8 30.5H1.5V24"
        stroke="#00FF41"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <circle cx="16" cy="16" r="10" stroke="#00FF41" strokeOpacity=".85" strokeWidth="1.25" />
      <circle cx="16" cy="16" r="5.5" stroke="#00FF41" strokeOpacity=".4" strokeDasharray="1.5 2" />
      <path d="M16 4.5v3M16 24.5v3M4.5 16h3M24.5 16h3" stroke="#00FF41" strokeOpacity=".6" strokeWidth="1.25" />
      <g className={animated ? 'radar-sweep' : undefined}>
        <path d="M16 16V6a10 10 0 0 1 8.66 5Z" fill="#00FF41" fillOpacity=".1" />
        <path d="M16 16l5-8.66a10 10 0 0 1 3.66 3.66Z" fill="#00FF41" fillOpacity=".14" />
        <path d="M16 16l7.43-6.69a10 10 0 0 1 1.23 1.69Z" fill="#00FF41" fillOpacity=".24" />
        <path d="M16 16l8.66-5" stroke="#B6FFC6" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <circle cx="20.6" cy="9.8" r="1.3" fill="#FACC15" className={animated ? 'radar-blip' : undefined} />
      <circle cx="16" cy="16" r="1.6" fill="#00FF41" />
    </svg>
  );
}

/** Mark + wordmark. `tagline` adds the small descriptor under the name (footer, auth pages). */
export function RadarLogo({
  className = '',
  tagline = false,
  animated = true,
}: {
  className?: string;
  tagline?: boolean;
  animated?: boolean;
}) {
  return (
    <span className={'inline-flex items-center gap-3 ' + className}>
      <RadarMark className="h-8 w-8 shrink-0 drop-shadow-[0_0_8px_rgba(0,255,65,0.45)]" animated={animated} />
      <span className="flex flex-col font-mono leading-none">
        <span className="text-[17px] font-extrabold tracking-[0.28em] text-white">
          RADAR<span className="caret-blink text-phosphor">_</span>
        </span>
        {tagline && (
          <span className="mt-1.5 text-[9px] tracking-[0.32em] text-phosphor/60">JOB INTELLIGENCE ENGINE</span>
        )}
      </span>
    </span>
  );
}

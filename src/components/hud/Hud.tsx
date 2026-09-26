// HUD primitives shared by the landing page, the info pages, the dashboard and settings.
// They reproduce the hero console: phosphor hairline border, corner brackets, a header bar.

import type { ReactNode } from 'react';

export type Tone = 'ok' | 'info' | 'warn' | 'alert' | 'idle';

const TONE: Record<Tone, string> = {
  ok: 'text-phosphor',
  info: 'text-hud-cyan',
  warn: 'text-hud-amber',
  alert: 'text-hud-red',
  idle: 'text-dim',
};
const DOT: Record<Tone, string> = {
  ok: 'bg-phosphor shadow-[0_0_8px_rgba(0,255,65,0.8)]',
  info: 'bg-hud-cyan shadow-[0_0_8px_rgba(34,211,238,0.8)]',
  warn: 'bg-hud-amber shadow-[0_0_8px_rgba(250,204,21,0.8)]',
  alert: 'bg-hud-red shadow-[0_0_8px_rgba(248,113,113,0.8)]',
  idle: 'bg-dim',
};

export function Brackets({ className = 'border-phosphor' }: { className?: string }) {
  const b = 'pointer-events-none absolute h-3 w-3 ' + className;
  return (
    <>
      <span className={b + ' -left-px -top-px border-l-2 border-t-2'} />
      <span className={b + ' -right-px -top-px border-r-2 border-t-2'} />
      <span className={b + ' -bottom-px -left-px border-b-2 border-l-2'} />
      <span className={b + ' -bottom-px -right-px border-b-2 border-r-2'} />
    </>
  );
}

export function StatusLight({
  tone = 'ok',
  pulse = true,
  children,
}: {
  tone?: Tone;
  pulse?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={'inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] ' + TONE[tone]}>
      <span className={'h-1.5 w-1.5 rounded-full ' + DOT[tone] + (pulse ? ' animate-pulse' : '')} />
      {children}
    </span>
  );
}

/** Bordered console box. `label`/`status` render the header bar; omit both for a bare panel. */
export function HudPanel({
  label,
  status,
  tone = 'ok',
  id,
  className = '',
  bodyClassName = 'p-5 sm:p-6',
  children,
}: {
  label?: ReactNode;
  status?: ReactNode;
  tone?: Tone;
  id?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className={'relative border border-phosphor/25 bg-black/65 backdrop-blur-[2px] ' + className}>
      <Brackets />
      {(label || status) && (
        <div className="flex items-center justify-between gap-4 border-b border-phosphor/20 px-4 py-2.5 font-mono text-[10px] tracking-[0.25em]">
          <span className="truncate text-phosphor/80">{label}</span>
          {status && <StatusLight tone={tone}>{status}</StatusLight>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/** "[01] KICKER" / big title / optional lead paragraph. */
export function SectionHeader({
  index,
  kicker,
  title,
  align = 'left',
  children,
}: {
  index?: string;
  kicker: string;
  title: ReactNode;
  align?: 'left' | 'center';
  children?: ReactNode;
}) {
  const center = align === 'center';
  return (
    <div className={'font-mono ' + (center ? 'mx-auto text-center' : '')}>
      <p className="text-[11px] tracking-[0.35em] text-phosphor/70">
        {index && <span className="text-phosphor">[{index}] </span>}
        {kicker}
      </p>
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">{title}</h2>
      {children && (
        <p className={'mt-5 max-w-2xl text-sm leading-relaxed text-dim sm:text-base ' + (center ? 'mx-auto' : '')}>
          {children}
        </p>
      )}
    </div>
  );
}

/** Inline terminal prompt: root@radar:~# <command> */
export function Prompt({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={'font-mono text-xs tracking-wider text-phosphor/80 ' + className}>
      <span className="text-phosphor">root@radar</span>
      <span className="text-dim">:~#</span> {children}
    </p>
  );
}

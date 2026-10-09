'use client';

// The signal filters for the Vault and Discovery: a rail of facets beside the list (quick queries, when jobs
// reached you, where they came from, the years they ask for, pay) and a query bar above it that prints the filters
// as a command and lets you drop any of them. Counts come from the jobs you have, each facet ignoring its own pick.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { HudPanel } from '@/components/hud/Hud';
import { Decrypt } from '@/components/hud/Decrypt';
import type { MatchedJob } from './types';
import {
  ALERT_SOURCE_KEYS,
  DAYS,
  DEFAULT_FILTERS,
  EXP_BUCKETS,
  LANES,
  ORIGINS,
  PAY_OPTIONS,
  PRESETS,
  activeCount,
  applyFilters,
  filterCommand,
  isDefault,
  isPreset,
  parseFilters,
  presetFilters,
  signalFacets,
  sourceTitle,
  type Day,
  type Origin,
  type SignalFilters,
  type StatedExperience,
  type VaultSort,
} from '@/lib/vault-filters';

type Stated = Record<string, StatedExperience>;

const toggle = <T,>(list: readonly T[], item: T) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/** Filters kept per list on this device (a per-viewer convenience: the defaults when storage is unavailable). */
export function useStoredFilters(key: string): [SignalFilters, (next: SignalFilters) => void] {
  const [filters, setFilters] = useState<SignalFilters>(DEFAULT_FILTERS);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring saved filters after mount
      if (stored) setFilters(parseFilters(stored));
    } catch {
      // storage unavailable: the defaults apply
    }
  }, [key]);
  const update = useCallback(
    (next: SignalFilters) => {
      setFilters(next);
      try {
        if (isDefault(next)) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage unavailable: the filters still apply for this visit
      }
    },
    [key],
  );
  return [filters, update];
}

// Phosphor icons (MIT), inline: where a job reached RADAR, and the remove mark on a filter token.
const ICONS: Record<Origin | 'remove', string> = {
  alert:
    'M224 44H32a12 12 0 0 0-12 12v136a20 20 0 0 0 20 20h176a20 20 0 0 0 20-20V56a12 12 0 0 0-12-12m-30.85 24L128 127.72L62.85 68ZM44 188V83.28l75.89 69.57a12 12 0 0 0 16.22 0L212 83.28V188Z',
  ats: 'M240 204h-12V96a20 20 0 0 0-20-20h-36V32a20 20 0 0 0-28.45-18.12l-104 48.54A20.06 20.06 0 0 0 28 80.55V204H16a12 12 0 0 0 0 24h224a12 12 0 0 0 0-24m-36-104v104h-32V100ZM52 83.09l96-44.79V204H52ZM132 112v12a12 12 0 0 1-24 0v-12a12 12 0 0 1 24 0m-40 0v12a12 12 0 0 1-24 0v-12a12 12 0 0 1 24 0m0 52v12a12 12 0 0 1-24 0v-12a12 12 0 0 1 24 0m40 0v12a12 12 0 0 1-24 0v-12a12 12 0 0 1 24 0',
  board:
    'M128 84a44 44 0 1 0 44 44a44.05 44.05 0 0 0-44-44m0 64a20 20 0 1 1 20-20a20 20 0 0 1-20 20m77.39 12.7a84 84 0 0 1-14.78 23.3a12 12 0 0 1-17.89-16a59.92 59.92 0 0 0 0-80a12 12 0 0 1 17.89-16a84.07 84.07 0 0 1 14.78 88.7M83.28 168a12 12 0 0 1-17.89 16a83.94 83.94 0 0 1 0-112a12 12 0 0 1 17.89 16a59.92 59.92 0 0 0 0 80M252 128a123.63 123.63 0 0 1-35.43 86.78A12 12 0 1 1 199.43 198a99.88 99.88 0 0 0 0-140a12 12 0 0 1 17.14-16.8A123.63 123.63 0 0 1 252 128M56.57 198a12 12 0 0 1-17.14 16.8a123.89 123.89 0 0 1 0-173.56A12 12 0 0 1 56.57 58a99.88 99.88 0 0 0 0 140',
  yours:
    'm224.15 179.17l-46.82-46.82l37.92-13.51c.26-.09.51-.19.76-.3a20 20 0 0 0-1.76-37.27L54.16 29A20 20 0 0 0 29 54.16l52.27 160.08a20 20 0 0 0 37.27 1.76c.11-.25.21-.5.3-.76l13.51-37.92l46.83 46.82a20 20 0 0 0 28.28 0l16.69-16.68a20 20 0 0 0 0-28.29m-30.83 25.17l-48.48-48.48A20 20 0 0 0 130.7 150a20.5 20.5 0 0 0-3.73.35A20 20 0 0 0 112.35 162c-.11.25-.2.5-.3.76L100.4 195.5L54.29 54.29L195.5 100.4l-32.71 11.65c-.25.09-.51.19-.76.3a20 20 0 0 0-6.16 32.48l48.48 48.48ZM84 16v-4a12 12 0 0 1 24 0v4a12 12 0 0 1-24 0m-72 92a12 12 0 0 1 0-24h4a12 12 0 0 1 0 24Zm108.62-83.79l4-12a12 12 0 0 1 22.77 7.58l-4 12a12 12 0 0 1-22.77-7.58m-81.23 104a12 12 0 0 1-7.59 15.17l-12 4a12 12 0 1 1-7.59-22.76l12-4a12 12 0 0 1 15.18 7.59',
  remove:
    'M208.49 191.51a12 12 0 0 1-17 17L128 145l-63.51 63.49a12 12 0 0 1-17-17L111 128L47.51 64.49a12 12 0 0 1 17-17L128 111l63.51-63.52a12 12 0 0 1 17 17L145 128Z',
};

function Glyph({ name, className = 'h-3.5 w-3.5' }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden className={'shrink-0 ' + className}>
      <path d={ICONS[name]} />
    </svg>
  );
}

/** A square check: filled when on, a bar when part of a group is on. */
function Check({ state }: { state: 'on' | 'some' | 'off' }) {
  return (
    <span
      aria-hidden
      className={
        'flex h-3.5 w-3.5 shrink-0 items-center justify-center border transition-colors ' +
        (state === 'off' ? 'border-phosphor/30' : 'border-phosphor bg-phosphor/15')
      }
    >
      {state !== 'off' && <span className={'bg-phosphor ' + (state === 'on' ? 'h-1.5 w-1.5' : 'h-0.5 w-2')} />}
    </span>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-mono text-[10px] font-bold tracking-[0.28em] text-phosphor/75">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ClearButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="font-mono text-[10px] tracking-[0.2em] text-dim transition-colors hover:text-hud-red"
    >
      CLEAR
    </button>
  );
}

const DAY_MS = 86_400_000;
function dayLabel(d: Day, now: number): string {
  if (d === 0) return 'Today';
  if (d === 1) return 'Yday';
  if (d === 7) return '7d+';
  return new Date(now - d * DAY_MS).toLocaleDateString('en-IN', { weekday: 'short' });
}
const dayName = (d: Day, now: number) =>
  d === 7 ? 'a week or more ago' : d === 1 ? 'yesterday' : d === 0 ? 'today' : dayLabel(d, now);

/** A column chart whose columns are toggles: the arrival timeline and the experience histogram share it. */
function Bars<K extends string | number>({
  label,
  bars,
  picked,
  onToggle,
  pulse,
}: {
  label: string;
  bars: { key: K; count: number; caption: string; name: string }[];
  picked: readonly K[];
  onToggle: (key: K) => void;
  /** A bar that gets the live blip while it has jobs (today). */
  pulse?: K;
}) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  return (
    <div
      role="group"
      aria-label={label}
      className="grid items-end gap-1"
      style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
    >
      {bars.map((b) => {
        const on = picked.includes(b.key);
        const dimmed = picked.length > 0 && !on;
        return (
          <button
            key={b.key}
            type="button"
            aria-pressed={on}
            aria-label={`${b.name}: ${b.count} jobs`}
            onClick={() => onToggle(b.key)}
            className="group flex min-w-0 flex-col items-center gap-1.5 focus-visible:outline-offset-1"
          >
            <span className={'font-mono text-[9px] tabular-nums ' + (on ? 'text-phosphor' : 'text-dim')}>
              {b.count || '·'}
            </span>
            <span className="relative flex h-14 w-full items-end bg-phosphor/[0.05]">
              <span
                className={
                  'w-full transition-[height,background-color] duration-300 ' +
                  (on
                    ? 'bg-phosphor shadow-[0_0_12px_rgba(0,255,65,0.55)]'
                    : dimmed
                      ? 'bg-phosphor/15 group-hover:bg-phosphor/35'
                      : 'bg-phosphor/45 group-hover:bg-phosphor/75')
                }
                style={{ height: b.count ? Math.max(8, (b.count / max) * 100) + '%' : '0%' }}
              />
              {pulse === b.key && b.count > 0 && (
                <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-phosphor motion-safe:animate-ping" />
              )}
            </span>
            <span
              className={
                'max-w-full truncate font-mono text-[8.5px] tracking-normal ' +
                (on ? 'text-phosphor' : pulse === b.key ? 'text-ink' : 'text-dim')
              }
            >
              {b.caption}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The facet rail. On phones it folds behind a header that says how many filters are on; from `lg` it is always open.
 */
export function FilterRail({
  list,
  stated = {},
  filters,
  onChange,
  label,
}: {
  list: MatchedJob[];
  stated?: Stated;
  filters: SignalFilters;
  onChange: (next: SignalFilters) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  // One clock for the rail: its day captions and arrival counts always agree.
  const [now] = useState(() => Date.now());
  const facets = useMemo(() => signalFacets(list, filters, stated, now), [list, filters, stated, now]);
  const presetCounts = useMemo(
    () => PRESETS.map((p) => applyFilters(list, presetFilters(p, filters.lane), stated, now).length),
    [list, filters.lane, stated, now],
  );
  const on = activeCount({ ...filters, lane: 'all' });
  const maxSource = Math.max(1, ...facets.sources.map((s) => s.count));

  return (
    <HudPanel label={label} status={on ? on + ' ACTIVE' : 'ALL SIGNALS'} tone={on ? 'ok' : 'idle'} bodyClassName="p-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 font-mono text-[11px] font-bold tracking-[0.25em] text-phosphor lg:hidden"
      >
        {open ? 'HIDE FILTERS' : on ? `FILTERS · ${on} ON` : 'FILTERS'}
        <span aria-hidden className={'transition-transform ' + (open ? 'rotate-180' : '')}>
          ▾
        </span>
      </button>

      <div
        className={
          (open ? 'max-lg:border-t max-lg:border-phosphor/15 ' : 'max-lg:hidden ') + 'divide-y divide-phosphor/10'
        }
      >
        <Section title="QUICK QUERIES">
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p, i) => {
              const active = isPreset(filters, p);
              return (
                <button
                  key={p.key}
                  type="button"
                  title={p.hint}
                  aria-pressed={active}
                  onClick={() =>
                    onChange(active ? { ...DEFAULT_FILTERS, lane: filters.lane } : presetFilters(p, filters.lane))
                  }
                  className={
                    'flex min-w-0 flex-col items-start gap-0.5 border px-2.5 py-2 text-left transition-colors ' +
                    (active
                      ? 'border-phosphor bg-phosphor/[0.12] shadow-[inset_0_0_14px_rgba(0,255,65,0.08)]'
                      : 'border-phosphor/15 hover:border-phosphor/45 hover:bg-phosphor/[0.04]')
                  }
                >
                  <span className="font-mono text-[9px] tracking-[0.2em] text-dim tabular-nums">
                    {presetCounts[i]} {presetCounts[i] === 1 ? 'JOB' : 'JOBS'}
                  </span>
                  <span className={'truncate text-[12.5px] font-medium ' + (active ? 'text-phosphor' : 'text-ink')}>
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          title="ARRIVED"
          aside={
            filters.days.length > 0 && (
              <ClearButton label="Clear arrival filter" onClick={() => onChange({ ...filters, days: [] })} />
            )
          }
        >
          <Bars
            label="When jobs reached you"
            bars={DAYS.map((d) => ({
              key: d,
              count: facets.days[d],
              caption: dayLabel(d, now),
              name: dayName(d, now),
            }))}
            picked={filters.days}
            pulse={0 as Day}
            onToggle={(d) => onChange({ ...filters, days: toggle(filters.days, d) })}
          />
        </Section>

        <Section
          title="SOURCES"
          aside={
            filters.sources.length > 0 && (
              <ClearButton label="Clear source filter" onClick={() => onChange({ ...filters, sources: [] })} />
            )
          }
        >
          <div className="space-y-3">
            {ORIGINS.map((o) => {
              const members = facets.sources.filter((s) => s.origin === o.key);
              if (!members.length && o.key !== 'alert') return null;
              const keys = members.map((s) => s.key);
              const picked = keys.filter((k) => filters.sources.includes(k));
              const state = !picked.length ? 'off' : picked.length === keys.length ? 'on' : 'some';
              const pickGroup = () =>
                onChange({
                  ...filters,
                  sources:
                    state === 'on'
                      ? filters.sources.filter((k) => !keys.includes(k))
                      : [...new Set([...filters.sources, ...keys])],
                });
              return (
                <div key={o.key}>
                  <button
                    type="button"
                    onClick={pickGroup}
                    disabled={!keys.length}
                    aria-pressed={state === 'on'}
                    title={o.hint}
                    className="flex w-full items-center gap-2 py-1 text-left disabled:cursor-default"
                  >
                    <Check state={state} />
                    <Glyph
                      name={o.key}
                      className={'h-3.5 w-3.5 ' + (state === 'off' ? 'text-phosphor/60' : 'text-phosphor')}
                    />
                    <span className="flex-1 font-mono text-[10px] font-bold tracking-[0.2em] text-ink">
                      {o.label.toUpperCase()}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-dim">{facets.origins[o.key]}</span>
                  </button>
                  {/* "Your finds" is one source: its group line says it all. */}
                  {o.key === 'yours' ? null : members.length > 0 ? (
                    <ul className="ml-[7px] mt-1 space-y-px border-l border-phosphor/15 pl-3">
                      {members.map((s) => {
                        const on = filters.sources.includes(s.key);
                        return (
                          <li key={s.key}>
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() => onChange({ ...filters, sources: toggle(filters.sources, s.key) })}
                              className="relative flex w-full items-center gap-2 overflow-hidden px-2 py-1 text-left transition-colors hover:bg-phosphor/[0.04]"
                            >
                              <span
                                aria-hidden
                                className={
                                  'absolute inset-y-0 left-0 ' + (on ? 'bg-phosphor/[0.14]' : 'bg-phosphor/[0.06]')
                                }
                                style={{ width: (s.count / maxSource) * 100 + '%' }}
                              />
                              <Check state={on ? 'on' : 'off'} />
                              <span
                                className={
                                  'relative flex-1 truncate text-[12.5px] ' + (on ? 'text-phosphor' : 'text-ink/85')
                                }
                              >
                                {sourceTitle(s.key)}
                              </span>
                              <span className="relative font-mono text-[11px] tabular-nums text-dim">{s.count}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <a
                      href="/settings#gmail"
                      className="ml-[22px] mt-1 block text-[11.5px] leading-relaxed text-hud-amber/80 transition-colors hover:text-hud-amber"
                    >
                      No alert jobs here yet. Link Gmail in Settings and your Indeed, LinkedIn and Welcome to the Jungle
                      alerts flow in every 6 hours.
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          title="EXPERIENCE ASKED"
          aside={
            filters.exp.length > 0 && (
              <ClearButton label="Clear experience filter" onClick={() => onChange({ ...filters, exp: [] })} />
            )
          }
        >
          <Bars
            label="Years the posting asks for"
            bars={EXP_BUCKETS.map((b) => ({ key: b.key, count: facets.exp[b.key], caption: b.short, name: b.label }))}
            picked={filters.exp}
            onToggle={(e) => onChange({ ...filters, exp: toggle(filters.exp, e) })}
          />
        </Section>

        <Section title="PAY FLOOR">
          <div role="radiogroup" aria-label="Pay floor" className="space-y-px">
            {PAY_OPTIONS.map((p) => {
              const on = filters.pay === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange({ ...filters, pay: p.key })}
                  className="flex w-full items-center gap-2.5 px-2 py-1 text-left transition-colors hover:bg-phosphor/[0.04]"
                >
                  <span
                    aria-hidden
                    className={
                      'flex h-3.5 w-3.5 items-center justify-center rounded-full border ' +
                      (on ? 'border-phosphor' : 'border-phosphor/30')
                    }
                  >
                    {on && <span className="h-1.5 w-1.5 rounded-full bg-phosphor" />}
                  </span>
                  <span className={'flex-1 text-[12.5px] ' + (on ? 'text-phosphor' : 'text-ink/85')}>{p.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-dim">{facets.pay[p.key]}</span>
                </button>
              );
            })}
          </div>
        </Section>
      </div>
    </HudPanel>
  );
}

const SORTS: { key: VaultSort; label: string }[] = [
  { key: 'score', label: 'MATCH' },
  { key: 'pay', label: 'PAY' },
  { key: 'newest', label: 'NEWEST' },
];

interface Token {
  field: string;
  value: string;
  clear: SignalFilters;
}

const listText = (items: string[]) => (items.length <= 2 ? items.join(', ') : `${items[0]} +${items.length - 1}`);

function tokens(f: SignalFilters, now: number): Token[] {
  const out: Token[] = [];
  if (f.lane !== 'all')
    out.push({
      field: 'LANE',
      value: LANES.find((l) => l.key === f.lane)?.label ?? f.lane,
      clear: { ...f, lane: 'all' },
    });
  if (f.days.length) {
    const days = [...f.days].sort((a, b) => a - b);
    const value =
      days.length === 1 && days[0] === 0
        ? 'Today'
        : days[0] === 0 && days.every((d, i) => d === i) && !days.includes(7)
          ? `Last ${days.length} days`
          : listText(days.map((d) => dayLabel(d, now)));
    out.push({ field: 'ARRIVED', value, clear: { ...f, days: [] } });
  }
  if (f.sources.length) {
    const alertsOnly =
      f.sources.length === ALERT_SOURCE_KEYS.length && ALERT_SOURCE_KEYS.every((k) => f.sources.includes(k));
    out.push({
      field: 'SOURCE',
      value: alertsOnly ? 'Your alerts' : listText(f.sources.map(sourceTitle)),
      clear: { ...f, sources: [] },
    });
  }
  if (f.exp.length)
    out.push({
      field: 'EXPERIENCE',
      value: listText(EXP_BUCKETS.filter((b) => f.exp.includes(b.key)).map((b) => b.label)),
      clear: { ...f, exp: [] },
    });
  if (f.pay !== 'any')
    out.push({
      field: 'PAY',
      value: PAY_OPTIONS.find((p) => p.key === f.pay)?.label ?? f.pay,
      clear: { ...f, pay: 'any' },
    });
  return out;
}

/** Above the list: the filters as a command, how many jobs pass, the sort, and a token per filter to drop it. */
export function QueryBar({
  filters,
  scope,
  shown,
  total,
  onChange,
}: {
  filters: SignalFilters;
  scope: string;
  shown: number;
  total: number;
  onChange: (next: SignalFilters) => void;
}) {
  const command = useMemo(() => filterCommand(filters, scope), [filters, scope]);
  const [now] = useState(() => Date.now());
  const active = tokens(filters, now);
  return (
    <div className="relative mb-6 border border-phosphor/20 bg-black/70 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <p className="flex min-w-0 items-center gap-2 text-xs">
          <span className="text-phosphor/45">$</span>
          <span className="truncate text-phosphor">
            <Decrypt text={command} />
          </span>
          <span aria-hidden className="h-3.5 w-1.5 shrink-0 bg-phosphor/70 motion-safe:animate-pulse" />
        </p>
        <div className="flex items-center gap-3 text-[10px] tracking-[0.2em]">
          <span className="text-dim" aria-live="polite">
            <span className="font-bold tabular-nums text-ink">{shown}</span> OF {total}
          </span>
          <div role="group" aria-label="Sort" className="flex border border-phosphor/20">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={filters.sort === s.key}
                onClick={() => onChange({ ...filters, sort: s.key })}
                className={
                  'px-2.5 py-1.5 font-bold transition-colors ' +
                  (filters.sort === s.key ? 'bg-phosphor text-black' : 'text-dim hover:text-phosphor')
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-phosphor/10 px-4 py-2.5">
          {active.map((t) => (
            <span key={t.field} className="flex items-stretch border border-phosphor/30 text-[10px]">
              <span className="bg-phosphor/[0.08] px-2 py-1 tracking-[0.2em] text-dim">{t.field}</span>
              <span className="px-2 py-1 font-sans text-[11.5px] text-phosphor">{t.value}</span>
              <button
                type="button"
                onClick={() => onChange(t.clear)}
                aria-label={`Remove the ${t.field.toLowerCase()} filter`}
                className="flex items-center border-l border-phosphor/20 px-1.5 text-dim transition-colors hover:bg-hud-red/15 hover:text-hud-red"
              >
                <Glyph name="remove" className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}
            className="ml-auto text-[10px] tracking-[0.2em] text-dim transition-colors hover:text-hud-red"
          >
            CLEAR ALL
          </button>
        </div>
      )}
    </div>
  );
}

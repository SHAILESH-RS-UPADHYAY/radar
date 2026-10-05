'use client';

import { useMemo } from 'react';
import { Brackets } from '@/components/hud/Hud';
import { Decrypt } from '@/components/hud/Decrypt';
import { SOURCE_NAMES } from '@/lib/scraper/catalog';
import {
  EXP_BUCKETS,
  filterCommand,
  isDefault,
  LANES,
  PAY_OPTIONS,
  type ExpBucket,
  type PayFilter,
  type VaultFacets,
  type VaultFilters,
  type VaultLane,
  type VaultSort,
} from '@/lib/vault-filters';

const SORTS: { key: VaultSort; label: string }[] = [
  { key: 'score', label: 'MATCH %' },
  { key: 'pay', label: 'PAY (LPA)' },
  { key: 'newest', label: 'NEWEST' },
];

export function VaultFiltersBar({
  filters,
  facets,
  total,
  filteredCount,
  onChange,
  onReset,
}: {
  filters: VaultFilters;
  facets: VaultFacets;
  total: number;
  filteredCount: number;
  onChange: (next: VaultFilters) => void;
  onReset: () => void;
}) {
  const cmd = useMemo(() => filterCommand(filters), [filters]);
  const hasActiveFilters = !isDefault(filters);

  const setLane = (lane: VaultLane) => {
    onChange({ ...filters, lane });
  };

  const toggleExp = (bucket: ExpBucket) => {
    const exists = filters.exp.includes(bucket);
    const nextExp = exists ? filters.exp.filter((b) => b !== bucket) : [...filters.exp, bucket];
    onChange({ ...filters, exp: nextExp });
  };

  const setSource = (source: string | null) => {
    onChange({ ...filters, source });
  };

  const setPay = (pay: PayFilter) => {
    onChange({ ...filters, pay });
  };

  const setSort = (sort: VaultSort) => {
    onChange({ ...filters, sort });
  };

  return (
    <div className="relative mb-6 border border-phosphor/25 bg-black/85 font-mono shadow-[0_0_30px_rgba(0,255,65,0.04)]">
      <Brackets />

      {/* Header: the live query, the hit counter, sort and reset */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-phosphor/15 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="text-phosphor/60">&gt;</span>
          <span className="truncate font-bold text-phosphor">
            <Decrypt text={cmd} />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold tracking-[0.2em]">
          <span className="border border-phosphor/30 bg-phosphor/10 px-2.5 py-1.5 text-phosphor">
            SIGNALS <span className="text-white">{filteredCount}</span>
            <span className="text-phosphor/50"> / {total}</span>
          </span>
          <div className="flex border border-phosphor/20" role="group" aria-label="Sort">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={filters.sort === s.key}
                onClick={() => setSort(s.key)}
                className={
                  'px-2.5 py-1.5 transition-colors ' +
                  (filters.sort === s.key ? 'bg-phosphor text-black' : 'text-dim hover:text-phosphor')
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="border border-hud-red/50 px-2.5 py-1.5 text-hud-red transition-colors hover:bg-hud-red/15"
            >
              ✕ RESET
            </button>
          )}
        </div>
      </div>

      {/* Filter rows: one label column, one chip style, one accent per group */}
      <div className="divide-y divide-phosphor/10">
        <Row label="LANE" tone="phosphor">
          {LANES.map((l) => (
            <Chip
              key={l.key}
              tone="phosphor"
              active={filters.lane === l.key}
              count={facets.lanes[l.key] ?? 0}
              title={l.hint}
              onClick={() => setLane(l.key)}
            >
              {l.label}
            </Chip>
          ))}
        </Row>

        <Row label="EXP" tone="cyan">
          <Chip tone="cyan" active={filters.exp.length === 0} onClick={() => onChange({ ...filters, exp: [] })}>
            ANY
          </Chip>
          {EXP_BUCKETS.map((b) => (
            <Chip
              key={b.key}
              tone="cyan"
              active={filters.exp.includes(b.key)}
              count={facets.exp[b.key] || 0}
              onClick={() => toggleExp(b.key)}
            >
              {b.label}
            </Chip>
          ))}
        </Row>

        <Row label="PAY" tone="amber">
          {PAY_OPTIONS.map((p) => (
            <Chip
              key={p.key}
              tone="amber"
              active={filters.pay === p.key}
              count={facets.pay[p.key] || 0}
              onClick={() => setPay(p.key)}
            >
              {p.label}
            </Chip>
          ))}
        </Row>

        <Row label="SOURCE" tone="phosphor">
          <div className="relative w-full sm:w-72">
            <select
              aria-label="Source"
              value={filters.source || ''}
              onChange={(e) => setSource(e.target.value || null)}
              className={
                'w-full appearance-none border bg-black py-1.5 pl-3 pr-8 text-[10px] font-bold tracking-[0.15em] transition-colors focus:outline-none ' +
                (filters.source
                  ? 'border-phosphor text-phosphor'
                  : 'border-phosphor/20 text-dim hover:border-phosphor/60 focus:border-phosphor')
              }
            >
              <option value="">ALL SOURCES ({total})</option>
              {facets.sources.map((s) => (
                <option key={s.key} value={s.key}>
                  {SOURCE_NAMES[s.key as keyof typeof SOURCE_NAMES] || s.key.toUpperCase()} ({s.count})
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-phosphor/60">
              ▼
            </span>
          </div>
        </Row>
      </div>
    </div>
  );
}

type Tone = 'phosphor' | 'cyan' | 'amber';

// Full class strings so Tailwind can see them.
const TONES: Record<Tone, { label: string; on: string; off: string }> = {
  phosphor: {
    label: 'text-phosphor/80',
    on: 'border-phosphor bg-phosphor text-black shadow-[0_0_12px_rgba(0,255,65,0.35)]',
    off: 'border-phosphor/20 text-dim hover:border-phosphor/60 hover:text-phosphor',
  },
  cyan: {
    label: 'text-hud-cyan/80',
    on: 'border-hud-cyan bg-hud-cyan text-black shadow-[0_0_12px_rgba(34,211,238,0.35)]',
    off: 'border-hud-cyan/20 text-dim hover:border-hud-cyan/60 hover:text-hud-cyan',
  },
  amber: {
    label: 'text-hud-amber/80',
    on: 'border-hud-amber bg-hud-amber text-black shadow-[0_0_12px_rgba(250,204,21,0.35)]',
    off: 'border-hud-amber/20 text-dim hover:border-hud-amber/60 hover:text-hud-amber',
  },
};

function Row({ label, tone, children }: { label: string; tone: Tone; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-4 py-3 sm:grid-cols-[5.5rem_1fr] sm:items-center sm:px-5">
      <span className={'text-[10px] font-bold tracking-[0.25em] ' + TONES[tone].label}>{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  tone,
  active,
  count,
  title,
  onClick,
  children,
}: {
  tone: Tone;
  active: boolean;
  count?: number;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const empty = count === 0 && !active;
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={
        'flex items-center gap-1.5 border bg-black/40 px-2.5 py-1.5 text-[10px] font-bold tracking-[0.15em] transition-all ' +
        (active ? TONES[tone].on : empty ? 'border-white/10 text-dim/40' : TONES[tone].off)
      }
    >
      <span>{children}</span>
      {count !== undefined && <span className={active ? 'text-black/60' : 'opacity-60'}>{count}</span>}
    </button>
  );
}

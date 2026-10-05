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
    <div className="relative mb-6 border border-phosphor/25 bg-black/85 p-4 font-mono shadow-[0_0_30px_rgba(0,255,65,0.03)] sm:p-5">
      <Brackets />

      {/* Terminal command line & results counter */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-phosphor/15 pb-3">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="text-phosphor/70">&gt;</span>
          <span className="truncate font-bold text-phosphor">
            <Decrypt text={cmd} />
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px] tracking-[0.2em]">
          <span className="border border-phosphor/30 bg-phosphor/10 px-2.5 py-1 text-phosphor">
            SIGNALS <span className="font-extrabold text-white">{filteredCount}</span>
            <span className="text-phosphor/60"> / {total}</span>
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="border border-hud-red/50 bg-hud-red/10 px-2.5 py-1 text-hud-red transition-colors hover:border-hud-red hover:bg-hud-red/20 hover:text-white"
            >
              [ ✕ RESET ]
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3.5">
        {/* Row 1: Category / Lanes Tabs */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="w-24 shrink-0 text-[10px] font-bold tracking-[0.25em] text-phosphor/80">LANE · CAT</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {LANES.map((l) => {
              const active = filters.lane === l.key;
              const count = facets.lanes[l.key] ?? 0;
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setLane(l.key)}
                  className={
                    'flex items-center gap-1.5 border px-2.5 py-1.5 text-[10px] font-bold tracking-[0.15em] transition-all ' +
                    (active
                      ? 'border-phosphor bg-phosphor text-black shadow-[0_0_14px_rgba(0,255,65,0.4)]'
                      : count > 0
                        ? 'border-phosphor/20 bg-black/40 text-dim hover:border-phosphor/60 hover:text-phosphor'
                        : 'border-white/10 bg-black/20 text-dim/40')
                  }
                >
                  <span>{l.label}</span>
                  <span className={active ? 'text-black/75' : 'text-dim/60'}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Experience */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="w-24 shrink-0 text-[10px] font-bold tracking-[0.25em] text-[#c792ea]">EXP · YRS</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange({ ...filters, exp: [] })}
              className={
                'border px-2.5 py-1.5 text-[10px] font-bold tracking-[0.15em] transition-all ' +
                (filters.exp.length === 0
                  ? 'border-[#c792ea] bg-[#c792ea] text-black shadow-[0_0_14px_rgba(199,146,234,0.4)]'
                  : 'border-[#c792ea]/20 bg-black/40 text-dim hover:border-[#c792ea]/60 hover:text-[#c792ea]')
              }
            >
              ALL
            </button>
            {EXP_BUCKETS.map((b) => {
              const active = filters.exp.includes(b.key);
              const count = facets.exp[b.key] || 0;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => toggleExp(b.key)}
                  className={
                    'flex items-center gap-1.5 border px-2.5 py-1.5 text-[10px] font-bold tracking-[0.15em] transition-all ' +
                    (active
                      ? 'border-[#c792ea] bg-[#c792ea] text-black shadow-[0_0_14px_rgba(199,146,234,0.4)]'
                      : count > 0
                        ? 'border-[#c792ea]/20 bg-black/40 text-dim hover:border-[#c792ea]/60 hover:text-[#c792ea]'
                        : 'border-white/10 bg-black/20 text-dim/40')
                  }
                >
                  <span>{b.label}</span>
                  <span className={active ? 'text-black/75' : 'text-dim/60'}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Grid of Source, Pay & Sort with uniform alignment */}
        <div className="grid grid-cols-1 gap-4 border-t border-phosphor/10 pt-3.5 xl:grid-cols-12">
          {/* Source dropdown */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center xl:col-span-4">
            <span className="w-24 shrink-0 text-[10px] font-bold tracking-[0.25em] text-[#22D3EE]">SRC · FEED</span>
            <div className="relative w-full min-w-0 sm:flex-1">
              <select
                value={filters.source || ''}
                onChange={(e) => setSource(e.target.value || null)}
                className="w-full appearance-none border border-[#22D3EE]/30 bg-black py-1.5 pl-3 pr-8 font-mono text-[10px] font-bold tracking-[0.15em] text-[#22D3EE] transition-colors hover:border-[#22D3EE] focus:border-[#22D3EE] focus:outline-none"
              >
                <option value="" className="bg-black text-white">
                  ALL SOURCES ({total})
                </option>
                {facets.sources.map((s) => {
                  const name = SOURCE_NAMES[s.key as keyof typeof SOURCE_NAMES] || s.key.toUpperCase();
                  return (
                    <option key={s.key} value={s.key} className="bg-black text-white">
                      {name} ({s.count})
                    </option>
                  );
                })}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-[#22D3EE]/70">
                ▼
              </span>
            </div>
          </div>

          {/* Pay filter */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center xl:col-span-5">
            <span className="w-24 shrink-0 text-[10px] font-bold tracking-[0.25em] text-hud-amber sm:w-auto">
              PAY · CTC
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {PAY_OPTIONS.map((p) => {
                const active = filters.pay === p.key;
                const count = facets.pay[p.key] || 0;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPay(p.key)}
                    className={
                      'flex items-center gap-1 border px-2 py-1.5 text-[10px] font-bold tracking-[0.15em] transition-all ' +
                      (active
                        ? 'border-hud-amber bg-hud-amber text-black shadow-[0_0_12px_rgba(250,204,21,0.4)]'
                        : count > 0
                          ? 'border-hud-amber/20 bg-black/40 text-dim hover:border-hud-amber/60 hover:text-hud-amber'
                          : 'border-white/10 bg-black/20 text-dim/40')
                    }
                  >
                    <span>{p.label}</span>
                    <span className={active ? 'text-black/75' : 'text-dim/60'}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort selector */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center xl:col-span-3 xl:justify-end">
            <span className="w-24 shrink-0 text-[10px] font-bold tracking-[0.25em] text-white/70 sm:w-auto">SORT</span>
            <div className="flex items-center border border-white/20 bg-black/40">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  className={
                    'px-2.5 py-1.5 text-[10px] font-bold tracking-[0.15em] transition-colors ' +
                    (filters.sort === s.key ? 'bg-white text-black' : 'text-dim hover:text-white')
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

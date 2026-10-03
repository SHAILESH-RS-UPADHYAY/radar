'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HudPanel } from '@/components/hud/Hud';
import type { Portfolio } from '@/types';
import { cleanUrl, MAX_PROJECTS } from '@/lib/validate';

const LINKS: [key: 'portfolio' | 'github' | 'linkedin' | 'website', label: string, placeholder: string][] = [
  ['portfolio', 'PORTFOLIO', 'yourname.dev'],
  ['github', 'GITHUB', 'github.com/yourname'],
  ['linkedin', 'LINKEDIN', 'linkedin.com/in/yourname'],
  ['website', 'PERSONAL SITE', 'blog.yourname.dev'],
];

const field =
  'w-full border border-phosphor/25 bg-black/60 px-3 py-2 font-mono text-sm text-phosphor placeholder:text-phosphor/30 focus:border-phosphor/70 focus:outline-none';
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * CONFIG://04 — your links and the sites or projects you built. INFILTRATE hands them to you ready to paste on every
 * application; OVERCLOCK may cite them in a tailored resume. `portfolio` is null until migration 008 has run.
 */
export function PortfolioSection({
  portfolio,
  onSave,
}: {
  portfolio: Portfolio | null;
  onSave: (next: Portfolio) => void;
}) {
  const [draft, setDraft] = useState({ name: '', url: '', note: '' });
  const [error, setError] = useState('');
  const links = portfolio ? LINKS.filter(([k]) => portfolio[k]).length : 0;

  const add = () => {
    if (!portfolio) return;
    const url = cleanUrl(draft.url);
    if (!draft.url.trim() || url === null) return setError('Add the site’s address, e.g. shop.example.com');
    const name = draft.name.trim() || host(url!);
    onSave({ ...portfolio, projects: [...portfolio.projects, { name, url: url!, note: draft.note.trim() }] });
    setDraft({ name: '', url: '', note: '' });
    setError('');
  };

  return (
    <HudPanel
      id="portfolio"
      label="CONFIG://04 · PORTFOLIO"
      status={portfolio ? `${links} LINKS · ${portfolio.projects.length} BUILT` : 'NEEDS MIGRATION'}
      tone={!portfolio ? 'warn' : links || portfolio.projects.length ? 'ok' : 'idle'}
      className="min-w-0 scroll-mt-24 xl:col-span-2"
    >
      <p className="-mt-1 mb-5 text-sm leading-relaxed text-dim">
        Your links and the sites you built. INFILTRATE puts them next to every application, ready to paste; OVERCLOCK
        can cite your projects in a tailored resume.
      </p>

      {!portfolio ? (
        <p className="font-mono text-xs text-hud-amber">
          Run supabase/migrations/008_portfolio.sql once, then your links and projects can be saved here.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {LINKS.map(([key, label, placeholder]) => (
              <label key={key}>
                <span className="mb-2 block font-mono text-[10px] tracking-[0.3em] text-dim">{label}</span>
                <input
                  // Remounts with the server's cleaned value (https:// added) after each save.
                  key={portfolio[key]}
                  defaultValue={portfolio[key]}
                  placeholder={placeholder}
                  inputMode="url"
                  spellCheck={false}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== portfolio[key])
                      onSave({ ...portfolio, [key]: e.target.value.trim() });
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className={field}
                />
              </label>
            ))}
          </div>

          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between font-mono text-[10px] tracking-[0.3em]">
              <span className="text-phosphor/80">BUILT://PROJECTS</span>
              <span className="text-dim">
                {portfolio.projects.length} / {MAX_PROJECTS}
              </span>
            </div>
            {portfolio.projects.length > 0 && (
              <ol className="mb-4 border border-phosphor/15">
                <AnimatePresence initial={false}>
                  {portfolio.projects.map((p, i) => (
                    <motion.li
                      key={p.url + i}
                      layout
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-start gap-3 border-b border-phosphor/10 px-4 py-3 last:border-b-0"
                    >
                      <span className="mt-0.5 font-mono text-[10px] text-dim">
                        0x{i.toString(16).toUpperCase().padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-sm font-bold text-white transition-colors hover:text-phosphor"
                        >
                          {p.name} <span className="text-phosphor/60">↗</span>
                        </a>
                        <p className="truncate font-mono text-[11px] text-dim">
                          {host(p.url)}
                          {p.note ? ' · ' + p.note : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={'Remove ' + p.name}
                        onClick={() => onSave({ ...portfolio, projects: portfolio.projects.filter((_, j) => j !== i) })}
                        className="font-mono text-sm text-phosphor/50 transition-colors hover:text-hud-red"
                      >
                        ×
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            )}

            {portfolio.projects.length < MAX_PROJECTS && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  add();
                }}
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]"
              >
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Name · e.g. Shop redesign"
                  aria-label="Project name"
                  className={field}
                />
                <input
                  value={draft.url}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                  placeholder="Link · shop.example.com"
                  aria-label="Project link"
                  inputMode="url"
                  spellCheck={false}
                  className={field}
                />
                <input
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  placeholder="What you built · e.g. rebuilt checkout in Next.js"
                  aria-label="What you built"
                  maxLength={160}
                  className={field}
                />
                <button
                  type="submit"
                  className="bg-phosphor px-5 py-2 font-mono text-[11px] font-bold tracking-[0.2em] text-black transition-colors hover:bg-[#33FF66]"
                >
                  + ADD
                </button>
              </form>
            )}
            {error && <p className="mt-2 font-mono text-[11px] text-hud-red">! {error}</p>}
          </div>
        </>
      )}
    </HudPanel>
  );
}

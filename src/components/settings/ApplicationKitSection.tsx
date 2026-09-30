'use client';

import { useEffect, useRef } from 'react';
import { HudPanel } from '@/components/hud/Hud';
import type { ApplicationKit } from '@/types';
import { BRIDGE_HREF } from '@/lib/apply/bridge';

type TextKey = Exclude<keyof ApplicationKit, 'needs_sponsorship' | 'willing_to_relocate' | 'voice_notes'>;

const GROUPS: { title: string; fields: [TextKey, string, string][] }[] = [
  {
    title: 'NOW',
    fields: [
      ['phone', 'PHONE', '+91 98765 43210'],
      ['current_company', 'CURRENT COMPANY', 'Northwind'],
      ['current_title', 'CURRENT TITLE', 'AI Engineer'],
      ['notice_period', 'NOTICE PERIOD', '30 days'],
    ],
  },
  {
    title: 'PAY',
    fields: [
      ['current_ctc', 'CURRENT CTC', '24 LPA'],
      ['expected_ctc', 'EXPECTED CTC', '32 LPA'],
      ['currency', 'CURRENCY', 'INR'],
      ['work_authorization', 'WORK AUTHORIZATION', 'Authorized to work in India'],
    ],
  },
  {
    title: 'OPTIONAL · EEO (US FORMS)',
    fields: [
      ['gender', 'GENDER', 'Decline to self-identify'],
      ['pronouns', 'PRONOUNS', 'she/her'],
      ['veteran_status', 'VETERAN STATUS', 'Decline to self-identify'],
      ['disability_status', 'DISABILITY STATUS', 'Decline to self-identify'],
    ],
  },
];

const field =
  'w-full border border-phosphor/25 bg-black/60 px-3 py-2 font-mono text-sm text-phosphor placeholder:text-phosphor/30 focus:border-phosphor/70 focus:outline-none';
const label = 'mb-2 block font-mono text-[10px] tracking-[0.3em] text-dim';

/**
 * CONFIG://05 — the answers application forms ask for again and again, saved once. HACK fills forms from it, the AI
 * drafts the rest in your voice, and the RADAR FILL bookmark puts them into the employer's form. `kit` is null until
 * migration 009 has run.
 */
export function ApplicationKitSection({
  kit,
  onSave,
}: {
  kit: ApplicationKit | null;
  onSave: (next: ApplicationKit) => void;
}) {
  const set = kit ? Object.values(kit).filter(Boolean).length : 0;
  // React refuses javascript: links in JSX; the bookmark's href is set on the element directly.
  const bridge = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    bridge.current?.setAttribute('href', BRIDGE_HREF);
  }, [kit]);

  return (
    <HudPanel
      id="kit"
      label="CONFIG://05 · APPLICATION_KIT"
      status={kit ? `${set} / 15 SET` : 'NEEDS MIGRATION'}
      tone={!kit ? 'warn' : set >= 6 ? 'ok' : 'idle'}
      className="min-w-0 scroll-mt-24 xl:col-span-2"
    >
      <p className="-mt-1 mb-5 text-sm leading-relaxed text-dim">
        What application forms keep asking. Saved once, HACK answers every form from it; the AI drafts only what this
        does not cover, in your words. Nothing is sent to an employer: you review and submit.
      </p>

      {!kit ? (
        <p className="font-mono text-xs text-hud-amber">
          Run supabase/migrations/009_sources_apply_kit.sql once, then the kit can be saved here.
        </p>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <fieldset key={g.title}>
              <legend className="mb-3 font-mono text-[10px] tracking-[0.35em] text-phosphor/80">{g.title}</legend>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {g.fields.map(([k, name, placeholder]) => (
                  <label key={k}>
                    <span className={label}>{name}</span>
                    <input
                      key={kit[k]}
                      defaultValue={kit[k]}
                      placeholder={placeholder}
                      onBlur={(e) => e.target.value.trim() !== kit[k] && onSave({ ...kit, [k]: e.target.value.trim() })}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      className={field}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <fieldset>
            <legend className="mb-3 font-mono text-[10px] tracking-[0.35em] text-phosphor/80">WORK</legend>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  ['needs_sponsorship', 'NEED VISA SPONSORSHIP?'],
                  ['willing_to_relocate', 'OPEN TO RELOCATING?'],
                ] as const
              ).map(([k, name]) => (
                <label key={k}>
                  <span className={label}>{name}</span>
                  <select
                    value={kit[k]}
                    onChange={(e) => onSave({ ...kit, [k]: e.target.value as ApplicationKit[typeof k] })}
                    className={field}
                  >
                    <option value="">— not set</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className={label}>IN YOUR OWN WORDS</span>
            <textarea
              key={kit.voice_notes}
              defaultValue={kit.voice_notes}
              maxLength={1500}
              rows={4}
              placeholder="Facts and phrasing the AI may use: what you are proud of, why you build, how you describe your work. Plain sentences, no bullet points needed."
              onBlur={(e) =>
                e.target.value.trim() !== kit.voice_notes && onSave({ ...kit, voice_notes: e.target.value.trim() })
              }
              className={field + ' resize-y leading-relaxed'}
            />
          </label>

          <div className="flex flex-col gap-3 border border-dashed border-phosphor/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-[0.35em] text-phosphor/80">BRIDGE://RADAR-FILL</p>
              <p className="mt-1 text-sm leading-relaxed text-dim">
                Drag this to your bookmarks bar once. On an application page: HACK → COPY FILL PACKET, then click it. It
                fills the form and marks Submit; it never presses it.
              </p>
            </div>
            <a
              ref={bridge}
              onClick={(e) => e.preventDefault()}
              draggable
              title="Drag me to your bookmarks bar"
              className="shrink-0 cursor-grab border border-phosphor bg-phosphor/10 px-5 py-2.5 text-center font-mono text-xs font-bold tracking-[0.25em] text-phosphor shadow-[0_0_20px_rgba(0,255,65,0.25)] active:cursor-grabbing"
            >
              ⚡ RADAR FILL
            </a>
          </div>
        </div>
      )}
    </HudPanel>
  );
}

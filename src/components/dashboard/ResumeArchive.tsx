import { HudPanel } from '@/components/hud/Hud';
import { timeAgo, type TailoredSummary } from './types';

const button = 'border px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.18em] transition-colors';
const nameOf = (t: TailoredSummary) => t.jobs?.employer || t.jobs?.companies?.name || 'Company';

/**
 * ARCHIVE://RESUMES — every resume OVERCLOCK ever wrote, newest first, whatever became of the job: each is stored in
 * tailored_resumes and its PDF is rendered from that record on demand. The ones sent with an application are frozen.
 */
export function ResumeArchive({
  items,
  sent,
  onReview,
}: {
  items: TailoredSummary[];
  /** resume_version_id of your applications. */
  sent: (string | null)[];
  onReview: (id: string) => void;
}) {
  if (!items.length) return null;
  const list = [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return (
    <div className="mt-8">
      <HudPanel label="ARCHIVE://RESUMES" status={list.length + ' STORED'} tone="info" bodyClassName="p-0">
        <ul>
          {list.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-phosphor/10 px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{t.jobs?.title || 'Job no longer listed'}</p>
                <p className="font-mono text-[11px] text-dim">
                  {nameOf(t)} · {timeAgo(t.created_at)}
                  {t.projected_score !== null && ` · ${t.base_score}% → ${t.projected_score}%`}
                  {sent.includes(t.id) && <span className="text-phosphor"> · SENT, FROZEN</span>}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onReview(t.id)}
                  className={button + ' border-phosphor/30 text-phosphor/80 hover:bg-phosphor/10'}
                >
                  VIEW
                </button>
                <a
                  href={`/api/overclock/${t.id}/pdf`}
                  className={button + ' border-phosphor/50 text-phosphor hover:bg-phosphor/10'}
                >
                  PDF ⬇
                </a>
              </div>
            </li>
          ))}
        </ul>
      </HudPanel>
    </div>
  );
}

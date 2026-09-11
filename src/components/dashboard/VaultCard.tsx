'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SkillChips } from './SkillChips';
import { formatSalary, scoreColor, timeAgo, type MatchAction, type MatchedJob } from './types';

const badge = 'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded';

export function VaultCard({
  match,
  onAction,
}: {
  match: MatchedJob;
  onAction: (id: string, action: MatchAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const { job } = match;
  const facts = [
    job.location,
    job.work_type?.toUpperCase(),
    job.experience_required ? 'Exp: ' + job.experience_required : null,
    formatSalary(job),
    job.posted_at ? 'Posted ' + timeAgo(job.posted_at) : null,
    job.company.source ? 'via ' + job.company.source : null,
  ].filter(Boolean);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="bg-[#111] border border-[#A67B5B]/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(166,123,91,0.05)]"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#A67B5B20] text-[#A67B5B]">
              {job.company.name}
            </span>
            {match.auto_saved && <span className={badge + ' bg-[#10B98115] text-[#10B981]'}>Auto-matched</span>}
            {!job.is_active && <span className={badge + ' bg-[#FF444415] text-[#FF6666]'}>Posting closed</span>}
          </div>
          <h3 className="text-white font-bold text-xl mb-1 leading-tight">{job.title}</h3>
          <p className="text-xs text-[#666] mb-3">{facts.join(' · ')}</p>
          <SkillChips matching={match.matching_skills} missing={match.missing_skills} maxMatching={8} maxMissing={5} />
          <p className="text-sm text-[#888]">{match.reasoning}</p>
          {job.description && (
            <>
              <button
                onClick={() => setOpen((o) => !o)}
                className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[#A67B5B] hover:opacity-80"
              >
                {open ? 'Hide details ▲' : 'Show full job details ▼'}
              </button>
              {open && (
                <div className="mt-3 p-4 rounded-lg bg-[#0A0A0A] border border-[#1A1A1A] text-sm text-[#AAA] whitespace-pre-line max-h-[480px] overflow-y-auto custom-scrollbar">
                  {job.description}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:min-w-[130px]">
          <span className="text-3xl font-black font-mono" style={{ color: scoreColor(match.score) }}>
            {match.score}%
          </span>
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAction(match.id, 'APPLY')}
            className="flex-1 sm:w-full text-center py-2 px-3 rounded text-xs font-bold uppercase tracking-wider bg-[#A67B5B] text-white hover:opacity-80 transition-all shadow-[0_0_15px_rgba(166,123,91,0.3)]"
          >
            APPLY
          </a>
          <button
            onClick={() => onAction(match.id, 'REMOVE_SAVE')}
            title="Remove from Vault"
            className="sm:w-full px-3 py-2 rounded border border-[#333] hover:border-[#FF4444] hover:text-[#FF4444] text-[#666] text-xs font-bold uppercase tracking-wider transition-all"
          >
            REMOVE
          </button>
        </div>
      </div>
    </motion.div>
  );
}

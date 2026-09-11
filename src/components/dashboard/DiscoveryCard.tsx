'use client';

import { motion } from 'framer-motion';
import { SkillChips } from './SkillChips';
import { formatSalary, scoreColor, timeAgo, type MatchAction, type MatchedJob } from './types';

export function DiscoveryCard({
  match,
  onAction,
}: {
  match: MatchedJob;
  onAction: (id: string, action: MatchAction) => void;
}) {
  const { job } = match;
  const meta = [
    job.location,
    job.department,
    formatSalary(job),
    timeAgo(job.posted_at),
    job.company.source ? 'via ' + job.company.source : null,
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, x: -100 }}
      transition={{ duration: 0.2 }}
      className="p-6 rounded-xl"
      style={{ background: '#111', border: '1px solid #222' }}
    >
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <span
              className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded"
              style={{ background: '#1A1A1A', color: '#A67B5B' }}
            >
              {job.company.name}
            </span>
            {job.work_type && (
              <span
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: job.work_type === 'remote' ? '#10B98115' : '#1A1A1A',
                  color: job.work_type === 'remote' ? '#10B981' : '#666',
                }}
              >
                {job.work_type.toUpperCase()}
              </span>
            )}
          </div>
          <h3 className="text-white font-bold text-xl mb-1">{job.title}</h3>
          <p className="text-sm mb-4 text-[#666]">{meta.filter(Boolean).join(' · ')}</p>
          <SkillChips matching={match.matching_skills} missing={match.missing_skills} />
          <p className="text-sm leading-relaxed text-[#888]">{match.reasoning}</p>
        </div>

        <div className="sm:ml-8 flex flex-col items-end gap-3 w-full sm:w-auto sm:min-w-[120px]">
          <div className="text-3xl font-black font-mono mb-2" style={{ color: scoreColor(match.score) }}>
            {match.score}%
          </div>
          <button
            onClick={() => onAction(match.id, 'SAVE')}
            className="w-full py-2 rounded text-xs font-bold uppercase tracking-wider text-white hover:bg-[#A67B5B] border border-[#333] bg-[#1A1A1A] transition-all"
          >
            TO VAULT
          </button>
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAction(match.id, 'APPLY')}
            className="w-full text-center py-2 rounded text-xs font-bold uppercase tracking-wider text-black bg-white hover:bg-gray-200 transition-all"
          >
            APPLY NOW
          </a>
          <button
            onClick={() => onAction(match.id, 'DISMISS')}
            className="w-full py-1 text-[10px] font-bold uppercase tracking-wider text-[#555] hover:text-[#FF6666] transition-colors"
          >
            NOT FOR ME
          </button>
        </div>
      </div>
    </motion.div>
  );
}

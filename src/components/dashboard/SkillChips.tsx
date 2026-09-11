const base = 'text-[10px] px-2 py-1 rounded-sm uppercase tracking-widest font-bold';

export function SkillChips({
  matching,
  missing,
  maxMatching = 5,
  maxMissing = 3,
}: {
  matching: string[];
  missing: string[];
  maxMatching?: number;
  maxMissing?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {matching.slice(0, maxMatching).map((s) => (
        <span
          key={'m-' + s}
          className={base}
          style={{ background: '#A67B5B10', color: '#A67B5B', border: '1px solid #A67B5B30' }}
        >
          {s}
        </span>
      ))}
      {missing.slice(0, maxMissing).map((s) => (
        <span
          key={'x-' + s}
          className={base}
          style={{ background: '#FF444410', color: '#FF6666', border: '1px solid #FF444430' }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

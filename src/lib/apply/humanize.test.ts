import { describe, expect, it } from 'vitest';
import { aiTells, humanize, MAX_ROUNDS, scrub } from './humanize';

const HUMAN =
  "I built the retrieval layer at Acme and spent most of last year making it fast. Your agents need the same thing. That's the part I'd like to own.";
const AI =
  "I am thrilled to apply! I'm passionate about leveraging cutting-edge AI — it truly resonates with me. Thank you for considering my application.";

describe('aiTells', () => {
  it('passes a plain, uneven human answer', () => {
    expect(aiTells(HUMAN)).toEqual([]);
  });

  it('catches stock words, punctuation and closers', () => {
    const tells = aiTells(AI);
    for (const t of [
      'a dash (— or –)',
      'an exclamation mark',
      'a stock closing',
      'stock wording "thrilled"',
      'stock wording "passionate"',
      'stock wording "leveraging"',
      'stock wording "cutting-edge"',
      'stock wording "truly"',
      'stock wording "resonates"',
    ])
      expect(tells).toContain(t);
  });

  it('matches every form of a stock word, and only stock words', () => {
    expect(aiTells('It resonated. I honed it. We leveraged it, passionately.')).toEqual([
      'stock wording "resonated"',
      'stock wording "honed"',
      'stock wording "leveraged"',
      'stock wording "passionately"',
    ]);
    expect(aiTells('Honest work on an edge case. I fixed the cutting tool. Elevators are slow.')).toEqual([]);
  });

  it('catches formatting and structure', () => {
    expect(aiTells('- shipped search\n- cut costs')).toContain('list formatting');
    expect(aiTells('I **love** this')).toContain('markdown');
    expect(aiTells('Not only did I ship it, but also I scaled it.')).toContain('"not only … but also"');
    expect(aiTells('As a backend engineer I build APIs.')).toContain('a stock opening');
    expect(aiTells('I ship fast APIs here. I write clean tests there. I fix slow queries daily.')).toContain(
      'every sentence about the same length',
    );
  });
});

describe('scrub', () => {
  it('removes formatting tells and keeps ranges and words', () => {
    expect(scrub('I led search — and it shipped! 2019–2021 🚀')).toBe('I led search, and it shipped. 2019-2021');
    expect(scrub('- **Fast** APIs; small team')).toBe('Fast APIs. Small team');
  });
});

/** A model stand-in: the validator flags `rounds` times, the fixer returns `fix(answer)`. */
function fakeModel(opts: { flagRounds: number; fix?: (a: string) => string; failFixer?: boolean }) {
  let reviews = 0;
  const calls: string[] = [];
  const complete = async (system: string, user: string) => {
    const isReview = system.startsWith('You review');
    calls.push(isReview ? 'review' : 'fix');
    if (isReview) {
      const answers = JSON.parse(user) as { name: string }[];
      const flag = reviews++ < opts.flagRounds;
      return {
        model: 'fake',
        text: JSON.stringify({
          reviews: answers.map((a) => ({ name: a.name, human: !flag, issues: flag ? ['too polished'] : [] })),
        }),
      };
    }
    if (opts.failFixer) throw new Error('down');
    const flagged = JSON.parse(user.split('<answers_to_fix>\n')[1].split('\n</answers_to_fix>')[0]) as {
      name: string;
      answer: string;
    }[];
    return {
      model: 'fake',
      text:
        '```json\n' +
        JSON.stringify({
          answers: flagged.map((f) => ({ name: f.name, value: (opts.fix ?? (() => HUMAN))(f.answer) })),
        }) +
        '\n```',
    };
  };
  return { complete, calls };
}

const later = () => Date.now() + 10 * 60_000;

describe('humanize', () => {
  it('validates, fixes, and stops when the validator finds nothing', async () => {
    const { complete, calls } = fakeModel({ flagRounds: 1 });
    const { values, report } = await humanize([{ name: 'why', label: 'Why us?', value: AI }], {
      context: '<job/>',
      deadline: later(),
      complete,
    });
    expect(values.get('why')).toBe(HUMAN);
    expect(report).toEqual({ rounds: 2, clean: true, fixed: 1 });
    expect(calls).toEqual(['review', 'fix', 'review']);
  });

  it("fixes RADAR's own findings even when the reviewer says human", async () => {
    const { complete } = fakeModel({ flagRounds: 0 });
    const { values, report } = await humanize([{ name: 'why', label: 'Why us?', value: AI }], {
      context: '',
      deadline: later(),
      complete,
    });
    expect(values.get('why')).toBe(HUMAN);
    expect(report.clean).toBe(true);
  });

  it(`stops after ${MAX_ROUNDS} rounds and says the validator was not satisfied`, async () => {
    const { complete } = fakeModel({ flagRounds: 99, fix: (a) => a });
    const { report } = await humanize([{ name: 'why', label: 'Why us?', value: HUMAN }], {
      context: '',
      deadline: later(),
      complete,
    });
    expect(report).toEqual({ rounds: MAX_ROUNDS, clean: false, fixed: MAX_ROUNDS });
  });

  it('keeps the draft (scrubbed) when the fixer fails', async () => {
    const { complete } = fakeModel({ flagRounds: 1, failFixer: true });
    const { values, report } = await humanize([{ name: 'why', label: 'Why us?', value: AI }], {
      context: '',
      deadline: later(),
      complete,
    });
    expect(values.get('why')).toBe(scrub(AI));
    expect(report.clean).toBe(false);
  });

  it('starts no round past the deadline, and still scrubs', async () => {
    const { complete, calls } = fakeModel({ flagRounds: 0 });
    const { values, report } = await humanize([{ name: 'why', label: 'Why us?', value: 'Great team!' }], {
      context: '',
      deadline: Date.now(),
      complete,
    });
    expect(calls).toEqual([]);
    expect(report.rounds).toBe(0);
    expect(values.get('why')).toBe('Great team.');
  });
});

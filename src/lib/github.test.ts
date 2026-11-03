import { describe, expect, it } from 'vitest';
import { githubProjects, githubUser, type GithubRepo } from './github';

const repo = (name: string, over: Partial<GithubRepo> = {}): GithubRepo => ({
  name,
  html_url: 'https://github.com/asha/' + name,
  description: null,
  language: null,
  stargazers_count: 0,
  fork: false,
  archived: false,
  pushed_at: '2026-10-01T00:00:00Z',
  ...over,
});

describe('github import', () => {
  it('reads the user from a profile link only', () => {
    expect(githubUser('https://github.com/asha')).toBe('asha');
    expect(githubUser('github.com/asha-rao/')).toBe('asha-rao');
    expect(githubUser('https://github.com/asha/radar')).toBeNull();
    expect(githubUser('https://gitlab.com/asha')).toBeNull();
  });

  it('keeps original, live repos, best first, skipping ones already listed', () => {
    const projects = githubProjects(
      [
        repo('old', { pushed_at: '2025-01-01T00:00:00Z' }),
        repo('fork', { fork: true, stargazers_count: 99 }),
        repo('rag', { stargazers_count: 12, description: 'RAG over PDFs', language: 'Python' }),
        repo('listed', { stargazers_count: 50 }),
        repo('new'),
      ],
      [{ name: 'Listed', url: 'https://github.com/asha/listed/', note: '' }],
      2,
    );
    expect(projects).toEqual([
      { name: 'rag', url: 'https://github.com/asha/rag', note: 'RAG over PDFs · Python' },
      { name: 'new', url: 'https://github.com/asha/new', note: '' },
    ]);
  });
});

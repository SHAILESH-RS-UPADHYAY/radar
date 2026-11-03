// GitHub import: your public repos → portfolio projects. The browser reads GitHub's public API directly (no token, no
// server): GitHub allows 60 reads an hour per IP, and an import is one read. Pure helpers; the fetch is in the UI.

import type { PortfolioProject } from '@/types';

export interface GithubRepo {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
  pushed_at: string;
}

/** "https://github.com/asha" → "asha"; null when the link is not a GitHub profile. */
export function githubUser(url: string): string | null {
  return url.match(/github\.com\/([a-z\d](?:[a-z\d-]{0,38}))\/?$/i)?.[1] ?? null;
}

/** Your best repos as projects: no forks or archives, most starred then most recent, none already listed. */
export function githubProjects(repos: GithubRepo[], existing: PortfolioProject[], room: number): PortfolioProject[] {
  const listed = new Set(existing.map((p) => p.url.replace(/\/$/, '').toLowerCase()));
  return repos
    .filter((r) => !r.fork && !r.archived && !listed.has(r.html_url.toLowerCase()))
    .sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.pushed_at) - Date.parse(a.pushed_at))
    .slice(0, Math.max(0, room))
    .map((r) => ({
      name: r.name.slice(0, 60),
      url: r.html_url,
      note: [r.description, r.language].filter(Boolean).join(' · ').slice(0, 160),
    }));
}

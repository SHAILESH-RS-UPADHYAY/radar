// The briefing's pages, in order. Plain module: the route (server) and the stage (client) both read it.
// '/briefing/look' (the look-first screen) sits before these and is not a numbered page.
export const STEPS = [
  { slug: '', label: 'What', title: 'What RADAR is' },
  { slug: 'find', label: 'Find', title: 'How it finds jobs' },
  { slug: 'match', label: 'Match', title: 'How it matches you' },
  { slug: 'apply', label: 'Apply', title: 'How you apply' },
  { slug: 'start', label: 'Start', title: 'Your data, and start' },
] as const;

export const LOOK_SLUG = 'look';
export const stepHref = (slug: string) => '/briefing' + (slug ? '/' + slug : '');

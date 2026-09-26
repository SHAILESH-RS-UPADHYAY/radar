import Link from 'next/link';
import { RadarLogo } from '@/components/brand/RadarLogo';
import { StatusLight } from '@/components/hud/Hud';
import { SITE_LINKS } from './links';

const ACCESS = [
  { href: '/dashboard', label: 'DASHBOARD' },
  { href: '/settings', label: 'PREFERENCES' },
  { href: '/sign-in', label: 'SIGN IN' },
];

const LEGAL = [
  { href: '/privacy', label: 'PRIVACY' },
  { href: '/terms', label: 'TERMS' },
];

export function SiteFooter() {
  const col = (title: string, links: { href: string; label: string }[]) => (
    <div>
      <p className="mb-4 font-mono text-[10px] tracking-[0.35em] text-dim">
        {'// '}
        {title}
      </p>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="font-mono text-xs tracking-[0.2em] text-phosphor/75 transition-colors hover:text-phosphor"
            >
              <span className="text-dim">→ </span>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer className="relative border-t border-phosphor/15 bg-black/80">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <RadarLogo tagline />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-dim">
            Watches the careers pages of the companies you care about, reads every opening, and drops the ones that fit
            you into your Vault.
          </p>
          <div className="mt-5">
            <StatusLight>ALL SYSTEMS NOMINAL</StatusLight>
          </div>
        </div>
        {col('SITEMAP', SITE_LINKS)}
        {col('ACCESS', ACCESS)}
        {col('LEGAL', LEGAL)}
      </div>
      <div className="border-t border-phosphor/10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-4 font-mono text-[10px] tracking-[0.2em] text-dim sm:flex-row sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} RADAR · AI JOB INTELLIGENCE ENGINE</span>
          <span>NEXT.JS · SUPABASE · PINECONE · CLERK</span>
        </div>
      </div>
    </footer>
  );
}

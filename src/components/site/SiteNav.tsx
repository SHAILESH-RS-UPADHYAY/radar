'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, UserButton } from '@clerk/nextjs';
import { RadarLogo } from '@/components/brand/RadarLogo';
import { SITE_LINKS } from './links';

/** Top bar for the public site. `overlay` keeps it transparent over the landing hero until you scroll. */
export function SiteNav({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const solid = !overlay || scrolled || open;

  return (
    <nav
      className={
        'fixed inset-x-0 top-0 z-50 transition-all duration-300 ' +
        (solid ? 'border-b border-phosphor/15 bg-black/80 py-3 backdrop-blur-md' : 'py-5')
      }
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="RADAR home" className="transition-opacity hover:opacity-85">
          <RadarLogo />
        </Link>

        <div className="hidden items-center gap-10 md:flex">
          {SITE_LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={
                  'font-mono text-[11px] tracking-[0.3em] transition-colors ' +
                  (active ? 'text-phosphor' : 'text-[#8a9a8e] hover:text-phosphor')
                }
              >
                {active && <span className="mr-1">▸</span>}
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className="hidden font-mono text-xs font-bold tracking-[0.25em] text-phosphor transition-opacity hover:opacity-80 sm:inline"
              >
                DASHBOARD
              </Link>
              <UserButton
                appearance={{ elements: { userButtonAvatarBox: 'h-8 w-8 rounded-none border border-phosphor/40' } }}
              />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden font-mono text-xs tracking-[0.2em] text-[#8a9a8e] transition-colors hover:text-phosphor sm:inline"
              >
                SIGN IN
              </Link>
              <Link
                href="/sign-up"
                className="whitespace-nowrap border border-phosphor/60 px-3 py-2 font-mono text-[11px] font-bold tracking-[0.25em] text-phosphor transition-colors hover:bg-phosphor/10 sm:px-4"
              >
                <span className="sm:hidden">[ LOGIN ]</span>
                <span className="hidden sm:inline">[ LOGIN TERMINAL ]</span>
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Menu"
            className="ml-1 flex h-9 w-9 items-center justify-center border border-phosphor/30 text-phosphor md:hidden"
          >
            <span className="font-mono text-sm">{open ? '×' : '≡'}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="mx-4 mt-3 border border-phosphor/20 bg-black/95 font-mono md:hidden">
          {[...SITE_LINKS, ...(isSignedIn ? [{ href: '/dashboard', label: 'DASHBOARD' }] : [])].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block border-b border-phosphor/10 px-4 py-3 text-xs tracking-[0.3em] text-phosphor/80 last:border-b-0 hover:bg-phosphor/5"
            >
              <span className="text-dim">$ cd </span>
              {l.label.toLowerCase()}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

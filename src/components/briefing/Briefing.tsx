'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useAuth } from '@clerk/nextjs';
import { RadarLogo } from '@/components/brand/RadarLogo';
import { SCENES, type Facts } from './scenes';
import { LOOK_SLUG, STEPS, stepHref } from './steps';
import './briefing.css';

// Its own chunk, drawn in the browser only: it starts on the look this browser has saved, which the server cannot know.
const LookFirst = dynamic(() => import('./LookFirst').then((m) => m.LookFirst), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-void" />,
});

const LAST = STEPS.length - 1;

/**
 * The briefing stage: five pages a visitor can walk before signing up (and reopen any time after).
 * The page shown comes from the URL. Moving between pages is history.pushState, which the router follows, so this
 * component never unmounts and each page can slide out while the next slides in.
 */
export function Briefing({ facts }: { facts: Facts }) {
  const slug = usePathname()
    .replace(/^\/briefing\/?/, '')
    .replace(/\/$/, '');
  const { isSignedIn } = useAuth();
  const at = Math.max(
    0,
    STEPS.findIndex((s) => s.slug === slug),
  );
  const [dir, setDir] = useState(1);
  // Page changes are spoken (and the first page slides in) only once the visitor has moved, not on a cold load.
  const [moved, setMoved] = useState(false);
  const back = useRef<HTMLButtonElement>(null);
  const forward = useRef<HTMLElement | null>(null);
  const refocus = useRef(false);
  const touch = useRef<[number, number] | null>(null);
  const onLook = slug === LOOK_SLUG;

  const go = useCallback(
    (i: number) => {
      if (i < 0 || i > LAST || i === at) return;
      // Back hides on page 1 and Next turns into a link on the last page. A keyboard that was on one of them
      // would be dropped at the top of the document: it moves to the forward control instead.
      const el = document.activeElement;
      refocus.current = (i === 0 && el === back.current) || (i === LAST && el === forward.current);
      setDir(i > at ? 1 : -1);
      setMoved(true);
      history.pushState(null, '', stepHref(STEPS[i].slug));
    },
    [at],
  );

  useEffect(() => {
    if (onLook) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') go(at + 1);
      if (e.key === 'ArrowLeft') go(at - 1);
    };
    const onPop = () => setMoved(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
    };
  }, [at, go, onLook]);

  // pushState does not retitle the tab.
  useEffect(() => {
    if (onLook) return;
    document.title = STEPS[at].title + ' · RADAR';
    if (refocus.current) forward.current?.focus({ preventScroll: true });
    refocus.current = false;
  }, [at, onLook]);

  if (onLook)
    return (
      <LookFirst
        onDone={() => {
          // "Change look" remembers the page it was opened from.
          const from = new URLSearchParams(location.search).get('from');
          setMoved(true);
          history.pushState(null, '', stepHref(STEPS.find((s) => s.slug === from)?.slug ?? ''));
        }}
      />
    );

  const exit = isSignedIn
    ? { href: '/dashboard', label: 'Back to dashboard' }
    : { href: '/sign-up', label: 'Skip to sign up' };
  const Scene = SCENES[at];
  const swipeEnd = (e: TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current[0];
    const dy = e.changedTouches[0].clientY - touch.current[1];
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(at + (dx < 0 ? 1 : -1));
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="bf relative flex min-h-dvh flex-col bg-void text-ink">
        <div className="hud-grid pointer-events-none fixed inset-0" aria-hidden="true" />

        <header className="relative z-10 mx-auto flex w-full max-w-[1360px] items-center justify-between gap-3 px-4 pt-4 sm:px-10 sm:pt-6">
          <Link
            href="/"
            aria-label="RADAR home"
            className="inline-flex min-h-11 items-center transition-opacity hover:opacity-85"
          >
            <RadarLogo />
          </Link>
          <div className="flex items-center gap-1 sm:gap-4">
            <Link
              href={stepHref(LOOK_SLUG) + (STEPS[at].slug ? '?from=' + STEPS[at].slug : '')}
              className="bf-quiet bf-hide-s"
            >
              Change look
            </Link>
            <Link href={exit.href} className="bf-quiet">
              {exit.label}
            </Link>
          </div>
        </header>

        {/* Progress: the five pages by name. Real links, so each can be opened or shared on its own. */}
        <nav aria-label="Briefing pages" className="relative z-10 mx-auto w-full max-w-[1360px] px-4 pt-5 sm:px-10">
          <ol className="bf-rail" style={{ '--p': at / STEPS.length } as CSSProperties}>
            {STEPS.map((s, i) => (
              <li key={s.slug}>
                <a
                  href={stepHref(s.slug)}
                  aria-current={i === at ? 'step' : undefined}
                  data-done={i < at || undefined}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                    e.preventDefault();
                    go(i);
                  }}
                >
                  <span className="bf-rail-dot" aria-hidden />
                  <span className="bf-rail-n">{i + 1}</span>
                  <span>{s.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <p className="sr-only" aria-live="polite">
          {moved ? `Page ${at + 1} of ${STEPS.length}: ${STEPS[at].title}` : ''}
        </p>

        <main
          className="relative z-10 flex flex-1 flex-col justify-center"
          onTouchStart={(e) => (touch.current = [e.touches[0].clientX, e.touches[0].clientY])}
          onTouchEnd={swipeEnd}
        >
          <AnimatePresence mode="wait" custom={dir} initial={moved}>
            <motion.div
              key={at}
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: 48 * d }),
                show: { opacity: 1, x: 0 },
                leave: (d: number) => ({ opacity: 0, x: -48 * d }),
              }}
              initial="enter"
              animate="show"
              exit="leave"
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className={'bf-page bf-page--' + (STEPS[at].slug || 'what')}
            >
              <div className="bf-copy">
                <Scene.Copy signedIn={!!isSignedIn} facts={facts} />
              </div>
              <div className="bf-scene">
                <Scene.Visual facts={facts} />
              </div>
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="bf-foot sticky bottom-0 z-20">
          <div className="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-3 px-4 py-3 sm:px-10 sm:py-4">
            <button
              ref={back}
              type="button"
              onClick={() => go(at - 1)}
              disabled={at === 0}
              className="bf-btn border border-phosphor/40 text-phosphor hover:bg-phosphor/10 disabled:invisible"
            >
              Back
            </button>
            <p className="bf-turn bf-soft text-sm">
              <span className="bf-turn-keys">The arrow keys turn the page too.</span>
              <span className="bf-turn-touch">or swipe</span>
            </p>
            {at === LAST ? (
              <Link
                ref={(el) => {
                  forward.current = el;
                }}
                href={exit.href}
                className="bf-btn bg-phosphor font-semibold text-black hover:bg-phosphor-hi"
              >
                {isSignedIn ? 'Back to dashboard' : 'Create your account'}
              </Link>
            ) : (
              <button
                ref={(el) => {
                  forward.current = el;
                }}
                type="button"
                onClick={() => go(at + 1)}
                className="bf-btn bg-phosphor font-semibold text-black hover:bg-phosphor-hi"
              >
                Next: {STEPS[at + 1].label}
              </button>
            )}
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}

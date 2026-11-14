import type { Metadata } from 'next';
import { Briefing } from '@/components/briefing/Briefing';
import { LOOK_SLUG, STEPS } from '@/components/briefing/steps';
import { CATALOG } from '@/lib/scraper/catalog';

// One route for every briefing page: each has its own URL and static HTML (deep links work), while a single client
// stage stays mounted, so Back / Next / arrows / swipe animate instead of reloading.
export const dynamicParams = false;

export function generateStaticParams() {
  return [...STEPS.map((s) => s.slug), LOOK_SLUG].map((slug) => ({ step: slug ? [slug] : [] }));
}

export async function generateMetadata({ params }: { params: Promise<{ step?: string[] }> }): Promise<Metadata> {
  const slug = (await params).step?.[0] ?? '';
  const step = STEPS.find((s) => s.slug === slug);
  const description = 'RADAR in five short pages: what it is, how it finds jobs, how it scores them, how you apply.';
  // The look screen is a doorway, not a page to find in a search engine.
  return step ? { title: step.title, description } : { title: 'Choose your look', robots: { index: false } };
}

export default function BriefingPage() {
  // Counted here, on the server, so the list of companies itself is not shipped to the browser.
  return <Briefing facts={{ feeds: CATALOG.tracked + CATALOG.boards.length, tracked: CATALOG.tracked }} />;
}

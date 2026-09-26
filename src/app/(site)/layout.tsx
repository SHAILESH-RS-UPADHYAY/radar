import { SiteNav } from '@/components/site/SiteNav';
import { SiteFooter } from '@/components/site/SiteFooter';

// Shared chrome for the public info pages: the landing hero's grid, glow, nav and footer.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-void">
      <div className="hud-grid pointer-events-none fixed inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(0,255,65,0.09),transparent_65%)]"
        aria-hidden="true"
      />
      <SiteNav />
      <main className="relative pt-20">{children}</main>
      <SiteFooter />
    </div>
  );
}

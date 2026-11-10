import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { RadarLogo } from '@/components/brand/RadarLogo';

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black bg-[linear-gradient(rgb(var(--glow)/0.03)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--glow)/0.03)_1px,transparent_1px)] bg-[size:20px_20px] font-mono relative overflow-hidden">
      <Link
        href="/"
        aria-label="RADAR home"
        className="absolute left-5 top-5 z-30 transition-opacity hover:opacity-85 sm:left-8 sm:top-7"
      >
        <RadarLogo tagline />
      </Link>
      {/* Scanline effect */}
      <div className="pointer-events-none fixed inset-0 z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20"></div>

      <SignUp
        appearance={{
          elements: {
            formButtonPrimary:
              'bg-phosphor hover:bg-phosphor-low text-black font-bold font-mono uppercase tracking-widest rounded-none border-none transition-colors',
            card: 'bg-black border border-phosphor/50 rounded-none shadow-[0_0_20px_rgb(var(--glow)/0.15)] font-mono p-8 relative z-20',
            headerTitle: 'text-phosphor font-mono uppercase tracking-wider text-xl',
            headerSubtitle: 'text-phosphor/70 font-mono text-sm',
            formFieldLabel: 'text-phosphor font-mono uppercase text-xs tracking-wider',
            formFieldInput:
              'bg-black border border-phosphor/30 text-phosphor font-mono rounded-none focus:ring-1 focus:ring-phosphor focus:border-phosphor transition-colors',
            footerActionText: 'text-phosphor/70 font-mono text-sm',
            footerActionLink:
              'text-phosphor hover:text-phosphor-low hover:underline font-mono text-sm transition-colors',
            identityPreviewText: 'text-phosphor font-mono',
            identityPreviewEditButton: 'text-phosphor/70 hover:text-phosphor font-mono',
            dividerLine: 'bg-phosphor/20',
            dividerText: 'text-phosphor/50 font-mono text-xs',
            socialButtonsBlockButton:
              'border border-phosphor/30 text-phosphor font-mono rounded-none hover:bg-phosphor/10 transition-colors bg-black',
            socialButtonsBlockButtonText: 'text-phosphor font-mono font-normal',
            formFieldSuccessText: 'text-phosphor font-mono',
            formFieldErrorText: 'text-red-500 font-mono',
            logoImage: 'filter invert sepia hue-rotate-[80deg] saturate-[500%] brightness-[100%]',
          },
          layout: {
            socialButtonsPlacement: 'bottom',
            showOptionalFields: false,
          },
        }}
      />
    </div>
  );
}

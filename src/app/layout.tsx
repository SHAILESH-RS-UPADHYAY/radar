import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter, JetBrains_Mono, Outfit } from 'next/font/google';
import './globals.css';
import SparkleCursor from '@/components/ui/SparkleCursor';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: { default: 'RADAR · AI Job Intelligence Engine', template: '%s · RADAR' },
  description: 'Your career, on autopilot. AI-powered job matching straight from company careers pages.',
  keywords: ['job search', 'AI', 'career', 'resume matching'],
};

export const viewport: Viewport = { themeColor: '#000401', colorScheme: 'dark' };

// One HUD theme for every Clerk surface (sign-in, sign-up, user menu). Clerk renders into the
// "clerk" CSS layer (declared in globals.css) so Tailwind classes passed via `elements` win over its defaults.
// Both the current and the older variable names are set; Clerk ignores the ones it does not know.
const clerkAppearance = {
  cssLayerName: 'clerk',
  variables: {
    colorPrimary: '#00FF41',
    colorBackground: '#000401',
    colorForeground: '#DCFFE3',
    colorText: '#DCFFE3',
    colorMutedForeground: '#7B9481',
    colorTextSecondary: '#7B9481',
    colorPrimaryForeground: '#000000',
    colorTextOnPrimaryBackground: '#000000',
    colorInput: '#000000',
    colorInputBackground: '#000000',
    colorInputForeground: '#00FF41',
    colorInputText: '#00FF41',
    colorNeutral: '#00FF41',
    colorDanger: '#F87171',
    fontFamily: 'var(--font-jetbrains), ui-monospace, monospace',
    borderRadius: '0px',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en">
        <body className={[inter.variable, outfit.variable, mono.variable, 'antialiased'].join(' ')}>
          {children}
          <SparkleCursor />
        </body>
      </html>
    </ClerkProvider>
  );
}

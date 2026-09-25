import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter, JetBrains_Mono, Outfit } from 'next/font/google';
import './globals.css';
import SparkleCursor from '@/components/ui/SparkleCursor';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'RADAR - AI Job Intelligence Engine',
  description: 'Your career, on autopilot. AI-powered job matching.',
  keywords: ['job search', 'AI', 'career', 'resume matching'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={[inter.variable, outfit.variable, mono.variable, 'antialiased'].join(' ')}>
          {children}
          <SparkleCursor />
        </body>
      </html>
    </ClerkProvider>
  );
}

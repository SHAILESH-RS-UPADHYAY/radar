import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "RADAR — AI Job Intelligence Engine",
  description: "Your career, on autopilot. AI-powered job matching that scrapes 50+ company career pages, scores matches against your resume, and surfaces the best opportunities — automatically.",
  keywords: ["job search", "AI", "career", "resume matching", "job intelligence", "fresher jobs", "India jobs"],
  openGraph: {
    title: "RADAR — AI Job Intelligence Engine",
    description: "Your career, on autopilot. AI-powered job matching for freshers and professionals.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.variable + " antialiased"} style={{ background: '#FAF7F5', color: '#1C1917' }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

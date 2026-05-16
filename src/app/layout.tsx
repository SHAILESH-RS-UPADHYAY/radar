 
 
 
 
 
 
 

/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";
import SparkleCursor from "@/components/ui/SparkleCursor";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "RADAR - AI Job Intelligence Engine",
  description: "Your career, on autopilot. AI-powered job matching.",
  keywords: ["job search", "AI", "career", "resume matching"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        </head>
        <body className={inter.variable + " antialiased"}>
          {children}
          <SparkleCursor />
      </body>
      </html>
    </ClerkProvider>
  );
}


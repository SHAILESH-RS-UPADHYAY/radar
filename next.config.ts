import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pdf-parse and its canvas binding load files at runtime (the pdf.js worker, a native module): keep them as real
  // packages so Vercel's file trace ships them.
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
};

export default nextConfig;

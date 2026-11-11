import type { MetadataRoute } from 'next';

// Makes RADAR installable (Chrome/Edge "Install app", Android "Add to home screen", iOS share sheet).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'RADAR · AI Job Intelligence',
    short_name: 'RADAR',
    description: 'Your career, on autopilot. AI job matching straight from company careers pages.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#000401',
    theme_color: '#000401',
    categories: ['productivity', 'business'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Dashboard', url: '/dashboard' },
      { name: 'Zero-Day', url: '/zero-day' },
      { name: 'Preferences', url: '/settings' },
    ],
  };
}

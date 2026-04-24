'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

const PALETTES = [
  { tubes: ['#A67B5B','#D6D3D1','#78716C'], lights: ['#C4A882','#E7E5E4','#A67B5B','#57534E'] },
  { tubes: ['#78716C','#A67B5B','#E7E5E4'], lights: ['#A67B5B','#D6D3D1','#78716C','#C4A882'] },
  { tubes: ['#C4A882','#57534E','#A8A29E'], lights: ['#78716C','#A67B5B','#E7E5E4','#57534E'] },
];
let pIdx = 0;

export default function TubesHero({ children }: { children?: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js' as any);
        const TubesCursor = mod.default ?? mod;
        if (!mounted || !canvasRef.current) return;
        appRef.current = TubesCursor(canvasRef.current, {
          tubes: { colors: PALETTES[0].tubes, lights: { intensity: 120, colors: PALETTES[0].lights } }
        });
        setLoaded(true);
      } catch(e) { console.warn('Tubes CDN failed', e); }
    })();
    return () => { mounted = false; };
  }, []);

  const handleClick = useCallback(() => {
    if (!appRef.current) return;
    pIdx = (pIdx + 1) % PALETTES.length;
    const p = PALETTES[pIdx];
    try { appRef.current.tubes?.setColors?.(p.tubes); appRef.current.tubes?.setLightsColors?.(p.lights); } catch(_){}
  }, []);

  return (
    <div className="relative w-full h-full" style={{ background: '#FAF7F5' }} onClick={handleClick}>
      {/* Canvas at reduced opacity so white background shows */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" style={{ touchAction: 'none', opacity: 0.35, mixBlendMode: 'multiply' }} />
      {/* Warm vignette overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(250,247,245,0.85) 100%)' }} />
      <div className="relative z-10 w-full h-full pointer-events-none">{children}</div>
      {loaded && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 text-[10px] uppercase tracking-[0.25em] pointer-events-none animate-pulse" style={{ color: 'rgba(166,123,91,0.5)' }}>
          click to shift tones
        </div>
      )}
    </div>
  );
}

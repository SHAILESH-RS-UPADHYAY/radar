'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

const PALETTES = [
  { tubes: ['#00FFD4','#8B5CF6','#FF3D71'], lights: ['#00FF88','#FFB700','#00FFD4','#8B5CF6'] },
  { tubes: ['#FF3D71','#00FFD4','#FFB700'], lights: ['#8B5CF6','#00FF88','#FF3D71','#00FFD4'] },
  { tubes: ['#8B5CF6','#00FF88','#FF3D71'], lights: ['#00FFD4','#FFB700','#8B5CF6','#00FF88'] },
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
          tubes: { colors: PALETTES[0].tubes, lights: { intensity: 180, colors: PALETTES[0].lights } }
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
    <div className="relative w-full h-full" onClick={handleClick}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" style={{ touchAction: 'none' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.55) 100%)' }} />
      <div className="relative z-10 w-full h-full pointer-events-none">{children}</div>
      {loaded && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 text-[10px] uppercase tracking-[0.25em] pointer-events-none animate-pulse" style={{ color: 'rgba(0,255,212,0.4)' }}>click to shift colors</div>}
    </div>
  );
}

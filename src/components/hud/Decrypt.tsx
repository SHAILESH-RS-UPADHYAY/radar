'use client';

import { useEffect, useState } from 'react';

const GLYPHS = '01<>/\\|{}[]#$%&*+=?!';

/** A line that shows as noise first and decrypts left to right. */
export function Decrypt({ text, className }: { text: string; className?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setShown((n) => (n >= text.length ? n : n + 2)), 22);
    return () => clearInterval(t);
  }, [text]);
  const rest = [...text.slice(shown)].map((c, i) => (c === ' ' ? ' ' : GLYPHS[(i * 7 + shown) % GLYPHS.length]));
  return (
    <span aria-label={text} className={className}>
      <span aria-hidden>{text.slice(0, shown)}</span>
      <span aria-hidden className="text-phosphor/40">
        {rest.join('')}
      </span>
    </span>
  );
}

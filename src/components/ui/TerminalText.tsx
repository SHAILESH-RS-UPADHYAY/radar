'use client';

import { useEffect, useState } from 'react';

interface TerminalTextProps {
  text: string;
  typingSpeed?: number;
  className?: string;
  delay?: number;
  onComplete?: () => void;
}

/** Types `text` out one character at a time with a blinking caret. */
export function TerminalText({ text, typingSpeed = 50, className = '', delay = 0, onComplete }: TerminalTextProps) {
  const [count, setCount] = useState(0);
  const done = count >= text.length;

  useEffect(() => {
    if (done) {
      onComplete?.();
      return;
    }
    const timeout = setTimeout(() => setCount((c) => c + 1), count === 0 ? delay + typingSpeed : typingSpeed);
    return () => clearTimeout(timeout);
  }, [count, done, delay, typingSpeed, onComplete]);

  return (
    <span className={`text-matrix font-mono ${className}`}>
      {text.slice(0, count)}
      {!done && <span className="terminal-input-caret ml-1"></span>}
    </span>
  );
}

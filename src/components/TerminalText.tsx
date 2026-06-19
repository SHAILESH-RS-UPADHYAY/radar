"use client";

import React, { useState, useEffect } from 'react';

interface TerminalTextProps {
  text: string;
  typingSpeed?: number;
  className?: string;
  delay?: number;
  onComplete?: () => void;
}

export function TerminalText({
  text,
  typingSpeed = 50,
  className = "",
  delay = 0,
  onComplete
}: TerminalTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (!hasStarted) {
      timeout = setTimeout(() => {
        setHasStarted(true);
        setIsTyping(true);
      }, delay);
      return () => clearTimeout(timeout);
    }

    if (isTyping) {
      if (displayedText.length < text.length) {
        timeout = setTimeout(() => {
          setDisplayedText(text.slice(0, displayedText.length + 1));
        }, typingSpeed);
      } else {
        setIsTyping(false);
        if (onComplete) onComplete();
      }
    }

    return () => clearTimeout(timeout);
  }, [displayedText, isTyping, text, typingSpeed, hasStarted, delay, onComplete]);

  return (
    <span className={`text-matrix font-mono ${className}`}>
      {displayedText}
      {(isTyping || !hasStarted) && <span className="terminal-input-caret ml-1"></span>}
    </span>
  );
}

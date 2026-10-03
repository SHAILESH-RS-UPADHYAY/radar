'use client';
// Temporary end-to-end harness for the extension, deleted after the test.
import { useEffect, useState } from 'react';
import { armInExtension, launchInExtension, onExtension, useExtension } from '@/lib/extension';

const value = (id: string) => (document.getElementById(id) as HTMLTextAreaElement).value;

export default function Preview() {
  const extension = useExtension();
  const [events, setEvents] = useState<string[]>([]);
  useEffect(
    () =>
      onExtension((e) => {
        setEvents((x) => [...x, JSON.stringify(e)]);
        // Stands in for RADAR's answers to the questions the tab read: [labelPattern, answer] pairs.
        if (e.type === 'questions' && e.matchId && e.id) {
          const map = JSON.parse(value('answers') || '[]') as [string, string][];
          const fields = (e.fields || [])
            .map((f) => ({ ...f, value: map.find(([re]) => new RegExp(re, 'i').test(f.label))?.[1] || '' }))
            .filter((f) => f.value);
          const reply = { matchId: e.matchId, more: { id: e.id, packet: { radar: 1 as const, job: 'test', fields } } };
          setTimeout(() => armInExtension(reply), 800);
        }
      }),
    [],
  );
  return (
    <div className="min-h-screen bg-void p-8 font-mono text-phosphor">
      <p id="ext">{extension || 'none'}</p>
      <textarea id="payload" className="w-full text-black" />
      <button id="go" onClick={() => launchInExtension(JSON.parse(value('payload')))}>
        go
      </button>
      <textarea id="arm" className="w-full text-black" />
      <button id="armgo" onClick={() => armInExtension(JSON.parse(value('arm')))}>
        arm
      </button>
      <textarea id="answers" className="w-full text-black" />
      <pre id="events">{events.join('\n')}</pre>
    </div>
  );
}

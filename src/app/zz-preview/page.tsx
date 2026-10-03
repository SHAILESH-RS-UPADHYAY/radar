'use client';
// Temporary end-to-end harness for the extension, deleted after the test.
import { useEffect, useState } from 'react';
import { launchInExtension, onExtension, useExtension } from '@/lib/extension';
import { keepResumeFile } from '@/lib/apply/client';

const value = (id: string) => (document.getElementById(id) as HTMLTextAreaElement).value;

export default function Preview() {
  const extension = useExtension();
  const [events, setEvents] = useState<string[]>([]);
  useEffect(() => onExtension((e) => setEvents((x) => [...x, JSON.stringify(e)])), []);
  return (
    <div className="min-h-screen bg-void p-8 font-mono text-phosphor">
      <p id="ext">{extension || 'none'}</p>
      <textarea id="payload" className="w-full text-black" />
      <button id="go" onClick={() => launchInExtension(JSON.parse(value('payload')))}>
        go
      </button>
      <input id="upload" type="file" onChange={(e) => e.target.files?.[0] && void keepResumeFile(e.target.files[0])} />
      <pre id="events">{events.join('\n')}</pre>
    </div>
  );
}

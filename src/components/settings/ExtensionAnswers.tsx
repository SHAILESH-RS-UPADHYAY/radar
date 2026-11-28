'use client';

import { useEffect } from 'react';
import { useApi } from '@/lib/use-api';
import { onExtension } from '@/lib/extension';
import { answerPageQuestions, rememberAnswer } from '@/lib/apply/client';

/**
 * A form tab's questions and taught answers go to whichever RADAR tab opened it. While that tab sits on Settings
 * (not the dashboard), this answers them, so the form never waits on "ANSWERING" forever.
 */
export function ExtensionAnswers() {
  const api = useApi();
  useEffect(
    () =>
      onExtension((e) => {
        if (!e.matchId) return;
        if (e.type === 'questions' && e.id && e.fields?.length)
          void answerPageQuestions(api, { matchId: e.matchId, id: e.id, fields: e.fields, company: 'RADAR' });
        if (e.type === 'learn' && e.question && e.answer) void rememberAnswer(api, e.question, e.answer);
      }),
    [api],
  );
  return null;
}

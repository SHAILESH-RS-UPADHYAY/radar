// The worker import must come first: it registers pdf.js's worker file so the serverless bundle (Vercel's file
// trace) ships it. Without it, parsing works locally but fails on Vercel, where that file is missing.
import 'pdf-parse/worker';
import { PDFParse } from 'pdf-parse';

/** Plain text of an uploaded PDF resume (first 15k chars); '' when the PDF has no text layer. Throws if unreadable. */
export async function extractPdfText(resumeFile: File): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(await resumeFile.arrayBuffer()) });
  try {
    // No "-- 1 of 2 --" page markers: they would make a scanned PDF look like it has text.
    const { text } = await parser.getText({ pageJoiner: '' });
    return (text || '').substring(0, 15000);
  } finally {
    await parser.destroy().catch(() => {});
  }
}

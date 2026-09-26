import * as pdfParseModule from 'pdf-parse';

/** Plain text of an uploaded PDF resume (first 15k chars), or '' if it has no text layer. */
export async function extractPdfText(resumeFile: File): Promise<string> {
  const buffer = Buffer.from(await resumeFile.arrayBuffer());
  const PDFParse = (pdfParseModule as unknown as { PDFParse?: unknown }).PDFParse || pdfParseModule;
  if (typeof PDFParse === 'function') {
    try {
      const parser = new (
        PDFParse as new (opts: { data: Uint8Array }) => { getText: () => Promise<{ text?: string }> }
      )({
        data: new Uint8Array(buffer),
      });
      const parsed = await parser.getText();
      return parsed.text?.substring(0, 15000) || '';
    } catch {
      const parsed = await (PDFParse as (buf: Buffer) => Promise<{ text?: string }>)(buffer);
      return parsed.text?.substring(0, 15000) || '';
    }
  }
  return '';
}

 
 
 
 
 
 
 

import * as pdfParseModule from 'pdf-parse';
const pdfParse = (pdfParseModule as any).PDFParse || pdfParseModule;
export async function GET() {
  return Response.json({
    type: typeof pdfParse,
    keys: Object.keys(pdfParse),
    hasDefault: !!(pdfParse as any).default,
    typeDefault: typeof (pdfParse as any).default,
    typeDefaultDefault: typeof (pdfParse as any)?.default?.default
  });
}

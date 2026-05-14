const fs = require('fs');
function fix(p) {
  let code = fs.readFileSync(p, 'latin1');
  code = code.replace(/[^\x00-\x7F]/g, '-');
  code = code.replace(/pc\.inference\.embed(\s*['"]([^'"]+)['"]\s*,\s*(.*?)\s,\s*(\{[\s\S]*?\})\s*)/g, 'pc.inference.embed({ model: \'$1\', inputs: $2, parameters: $3 })');
  fs.writeFileSync(p, code, 'utf8');
}
fix('src/lib/ai/embeddings.ts');
fix('scripts/embed-jobs.ts');
fix('src/app/api/scrape/route.ts');
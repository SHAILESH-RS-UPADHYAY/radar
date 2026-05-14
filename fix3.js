const fs = require('fs');

let code = fs.readFileSync('src/lib/ai/embeddings.ts', 'utf8');

code = code.replace(
  "Array.from(response.data[0].values as number[]);",
  "Array.from((response.data[0] as any).values as number[]);"
);

code = code.replace(
  "values: Array.from(embeddings.data[idx].values as number[]),",
  "values: Array.from((embeddings.data[idx] as any).values as number[]),"
);

fs.writeFileSync('src/lib/ai/embeddings.ts', code, 'utf8');
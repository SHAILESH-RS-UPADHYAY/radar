const fs = require('fs');

let code = fs.readFileSync('src/lib/ai/embeddings.ts', 'utf8');
code = code.replace(
  "pc.inference.embed('multilingual-e5-large', [cleanText], {",
  "pc.inference.embed({ model: 'multilingual-e5-large', inputs: [cleanText], parameters: {"
);
code = code.replace(
  "pc.inference.embed('multilingual-e5-large', texts, {",
  "pc.inference.embed({ model: 'multilingual-e5-large', inputs: texts, parameters: {"
);

// We need to add the closing brace for the outer object }) instead of just ).
// Actually the original has }); at the end.
// For [cleanText]:
code = code.replace(
  "    truncate: 'END',\r\n  });",
  "    truncate: 'END',\r\n  } });"
);
code = code.replace(
  "    truncate: 'END',\n  });",
  "    truncate: 'END',\n  } });"
);

// For texts:
code = code.replace(
  "      truncate: 'END',\r\n    });",
  "      truncate: 'END',\r\n    } });"
);
code = code.replace(
  "      truncate: 'END',\n    });",
  "      truncate: 'END',\n    } });"
);

fs.writeFileSync('src/lib/ai/embeddings.ts', code, 'utf8');
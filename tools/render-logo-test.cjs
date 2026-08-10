const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.resolve(__dirname, '../frontend/src/logo/nabaPaths.ts'),
  'utf8',
);

function extract(varName) {
  const marker = `export const ${varName}`;
  const start = src.indexOf(marker);
  const eq = src.indexOf('=', start);
  // Find the matching end: a top-level ";\n" after the opening bracket.
  let i = eq + 1;
  while (/\s/.test(src[i])) i++;
  const openChar = src[i];
  const closeChar = openChar === '[' ? ']' : '}';
  let depth = 0;
  let end = i;
  for (; end < src.length; end++) {
    if (src[end] === openChar) depth++;
    else if (src[end] === closeChar) {
      depth--;
      if (depth === 0) { end++; break; }
    }
  }
  return JSON.parse(src.slice(i, end));
}

const basePaths = extract('basePaths');
const hamzaPath = extract('hamzaPath');
const harakatPaths = extract('harakatPaths');
const viewBox = extract('viewBox');

const all = [...basePaths, hamzaPath, ...harakatPaths];
const groups = all
  .map((g) => `<path d="${g.d}" transform="${g.transform}" fill="#EDE8DC"/>`)
  .join('\n    ');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{background:#0D0D0D;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
svg{border:1px solid #333}</style>
</head><body>
<svg width="700" height="500" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" xmlns="http://www.w3.org/2000/svg">
    ${groups}
</svg>
</body></html>`;

fs.writeFileSync('/tmp/naba-logo-test.html', html);
console.log('wrote /tmp/naba-logo-test.html');
console.log('basePaths:', basePaths.length, 'hamza: 1, harakat:', harakatPaths.length);
console.log('viewBox:', viewBox);

// Generates the app icon set from the real font-shaped نَبَأ paths in
// frontend/src/logo/nabaPaths.ts — gold wordmark, charcoal/near-black ground.
// Run: node gen-app-icons.cjs   (needs `sharp`, installed in this tools/ dir)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const GOLD = '#C9A355';
const CHARCOAL = '#0D0D0D';

const src = fs.readFileSync(
  path.resolve(__dirname, '../frontend/src/logo/nabaPaths.ts'),
  'utf8',
);

function extract(varName) {
  const marker = `export const ${varName}`;
  const start = src.indexOf(marker);
  const eq = src.indexOf('=', start);
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

function wordmarkGroup(fill) {
  return all.map((g) => `<path d="${g.d}" transform="${g.transform}" fill="${fill}"/>`).join('\n    ');
}

// Centers the word's natural bounding box (viewBox) inside a `size`x`size`
// canvas, scaled so it occupies (1 - 2*margin) of the canvas on its longer
// axis, preserving aspect ratio.
function buildSvg({ size, margin, background, fill }) {
  const usable = size * (1 - 2 * margin);
  const scale = usable / Math.max(viewBox.width, viewBox.height);
  const cx = size / 2;
  const cy = size / 2;
  const vbCx = viewBox.x + viewBox.width / 2;
  const vbCy = viewBox.y + viewBox.height / 2;
  const tx = cx - scale * vbCx;
  const ty = cy - scale * vbCy;
  const bg = background ? `<rect x="0" y="0" width="${size}" height="${size}" fill="${background}"/>` : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${bg}
  <g transform="translate(${tx} ${ty}) scale(${scale})">
    ${wordmarkGroup(fill)}
  </g>
</svg>`;
}

const OUT = path.resolve(__dirname, '../frontend/assets/images');

async function render(name, svg, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(OUT, name));
  console.log('wrote', name);
}

(async () => {
  // Full-bleed icons: opaque charcoal ground, generous margin so the tall
  // hamza/harakat stack never crowds the edge or gets clipped by OS masking.
  const full = buildSvg({ size: 1024, margin: 0.16, background: CHARCOAL, fill: GOLD });
  await render('icon.png', full, 1024);
  await render('icon-ios.png', full, 1024);

  // Android adaptive icon foreground: transparent ground (background color
  // comes from app.json's adaptiveIcon.backgroundColor), larger margin so
  // the artwork survives circle/squircle/rounded-square masking.
  const adaptive = buildSvg({ size: 1024, margin: 0.26, background: null, fill: GOLD });
  await render('adaptive-icon.png', adaptive, 1024);

  // Favicon: same composition, small canvas.
  const favicon = buildSvg({ size: 64, margin: 0.14, background: CHARCOAL, fill: GOLD });
  await render('favicon.png', favicon, 64);

  // Native splash image: transparent ground (expo-splash-screen's own
  // backgroundColor #0D0D0D shows behind it), rendered via `contain` at
  // imageWidth 200 per app.json — was leftover Emergent.sh placeholder art.
  const splash = buildSvg({ size: 1024, margin: 0.22, background: null, fill: GOLD });
  await render('splash-icon.png', splash, 1024);

  console.log('Done.');
})();

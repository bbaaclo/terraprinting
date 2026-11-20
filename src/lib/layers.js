// Sorts the traced design into the five layers staff work with:
// Color, Pattern, Logo, Name, Number. Simple rules plus the words found by
// text recognition; staff can move a shape to another layer by hand.
//
// Bottom-to-top order in the SVG. Each layer keeps the shapes' original
// order, and whole words/logos move together (letters with their holes).
export const GROUPS = [
  { key: 'color', label: 'Color' },
  { key: 'pattern', label: 'Pattern' },
  { key: 'logo', label: 'Logo' },
  { key: 'name', label: 'Name' },
  { key: 'number', label: 'Number' },
];

const MIN_NUMBER_CONFIDENCE = 55;
const MIN_WORD_CONFIDENCE = 70;

// Reads every <path> with its fill and bounding box (measured by the browser).
export function readPaths(svgMarkup) {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const svg = doc.documentElement;
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;left:-99999px;top:0;width:10px;height:10px;overflow:hidden;visibility:hidden';
  const live = document.importNode(svg, true);
  holder.appendChild(live);
  document.body.appendChild(holder);
  const serializer = new XMLSerializer();
  const paths = [...live.querySelectorAll('path')].map((el) => {
    const b = el.getBBox();
    return {
      markup: serializer.serializeToString(el).replace(/ xmlns="[^"]*"/, ''),
      fill: (el.getAttribute('fill') || '#000000').toUpperCase(),
      box: { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height },
      area: b.width * b.height,
    };
  });
  holder.remove();
  const vb = (svg.getAttribute('viewBox') || '0 0 1 1').split(/\s+/).map(Number);
  return { paths, viewWidth: vb[2], viewHeight: vb[3] };
}

// traced: shapes from the full trace. silhouette: the smooth outline shapes
// in the main color. Returns { data, assign } where dropped shapes
// (big base pieces and fabric shading, now covered by Color) are removed.
export function classify(traced, silhouette, words, colorCounts) {
  const { viewWidth, viewHeight } = traced;
  const canvasArea = viewWidth * viewHeight;
  const paths = traced.paths;
  const assign = new Array(paths.length).fill(null);

  // --- Words: numbers, and every other word goes to Name ---
  const minHeight = viewHeight * 0.012;
  const clean = words
    .map((w) => ({ ...w, text: (w.text || '').replace(/[^A-Za-z0-9]/g, '') }))
    .filter((w) => w.text.length >= 1 && w.bbox.y1 - w.bbox.y0 >= minHeight);
  const numbers = clean.filter((w) => /^\d{1,3}$/.test(w.text) && w.confidence >= MIN_NUMBER_CONFIDENCE);
  const alpha = clean.filter((w) => /[A-Za-z]{3,}/.test(w.text) && w.confidence >= MIN_WORD_CONFIDENCE);
  for (const w of numbers) assignInside(paths, assign, pad(w.bbox, 0.15), 'number');
  for (const w of alpha) assignInside(paths, assign, pad(w.bbox, 0.15), 'name');

  // --- Colors ---
  const totalPx = Object.values(colorCounts).reduce((a, b) => a + b, 0) || 1;
  const colors = Object.entries(colorCounts).map(([hex, n]) => ({ hex, share: n / totalPx, rgb: hexToRgb(hex) }));
  colors.sort((a, b) => b.share - a.share);
  const main = colors[0];

  // Logo: shapes in a rare, clearly colored tone, plus everything inside them.
  const rare = new Set(colors.filter((c) => c.share < 0.025 && chroma(c.rgb) > 60).map((c) => c.hex));
  const seeds = paths.map((p, i) => i).filter((i) => !assign[i] && rare.has(paths[i].fill) && paths[i].area < canvasArea * 0.05);
  for (const box of mergeBoxes(seeds.map((i) => paths[i].box), viewWidth * 0.02)) {
    assignInside(paths, assign, pad(box, 0.1), 'logo');
  }

  // Fabric shading: soft grey tones close to the main color. Large streaks
  // are dropped (the clean Color layer shows through); small ones stay in
  // Pattern because thin pattern lines often use the same tone.
  const shadingTones = new Set(
    colors.filter((c) => main && c !== main && chroma(c.rgb) < 35 && Math.sqrt(dist2(c.rgb, main.rgb)) < 90).map((c) => c.hex),
  );

  const drop = new Array(paths.length).fill(false);
  paths.forEach((p, i) => {
    if (assign[i]) return;
    const big = p.area >= canvasArea * 0.03;
    if (main && p.fill === main.hex && big) drop[i] = true;            // replaced by the Color layer
    else if (shadingTones.has(p.fill) && p.area >= canvasArea * 0.003) drop[i] = true; // fold or shadow
    else assign[i] = 'pattern';
  });

  const keptPaths = [];
  const keptAssign = [];
  for (const p of silhouette?.paths ?? []) { keptPaths.push(p); keptAssign.push('color'); }
  paths.forEach((p, i) => { if (!drop[i]) { keptPaths.push(p); keptAssign.push(assign[i]); } });
  return { data: { paths: keptPaths, viewWidth, viewHeight }, assign: keptAssign };
}

// Builds the SVG with one named group per layer. Inkscape reads the
// inkscape:label as the layer name; Illustrator uses the id.
// In the downloaded file, all shapes of the same color inside a layer are
// joined into one compound shape, so each layer has one shape per color
// (usually 1 to 3). Shapes never overlap (cutout tracing), so the even-odd
// fill rule keeps every hole and detail exactly as traced.
// The preview keeps the separate pieces so a single piece can be clicked
// and moved to another layer.
export function buildLayeredSvg({ paths, viewWidth, viewHeight }, assign, width, height, options = {}) {
  const { hidden = new Set(), forPreview = false } = options;
  const parts = [];
  for (const g of GROUPS) {
    if (hidden.has(g.key)) continue;
    const inLayer = paths.map((p, i) => [p, i]).filter(([, i]) => assign[i] === g.key);
    const colorMap = layerColorMap(inLayer.map(([p]) => p));
    const members = forPreview
      ? inLayer.map(([p, i]) => p.markup
        .replace('<path', `<path data-i="${i}"`)
        .replace(/fill="#[0-9A-Fa-f]{6}"/, `fill="${colorMap.get(p.fill)}"`))
      : mergeByColor(inLayer.map(([p]) => p), colorMap);
    if (!members.length) continue;
    parts.push(`<g id="${g.label}" inkscape:groupmode="layer" inkscape:label="${g.label}">\n${members.join('\n')}\n</g>`);
  }
  return `${forPreview ? '' : '<?xml version="1.0" encoding="UTF-8"?>\n'}<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${viewWidth} ${viewHeight}">\n${parts.join('\n')}\n</svg>`;
}

// Each layer keeps at most 3 colors: its 3 largest by area. Smaller tones
// (edge blends, faint bits) take the nearest of those 3, so every layer
// ends up as 1 to 3 shapes.
const MAX_COLORS_PER_LAYER = 3;

function layerColorMap(layerPaths) {
  const byColor = {};
  for (const p of layerPaths) byColor[p.fill] = (byColor[p.fill] || 0) + p.area;
  const ranked = Object.entries(byColor).sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
  const keep = ranked.slice(0, MAX_COLORS_PER_LAYER);
  const map = new Map();
  for (const hex of ranked) {
    if (keep.includes(hex)) { map.set(hex, hex); continue; }
    const rgb = hexToRgb(hex);
    map.set(hex, keep.reduce((best, k) => (dist2(hexToRgb(k), rgb) < dist2(hexToRgb(best), rgb) ? k : best), keep[0]));
  }
  return map;
}

function mergeByColor(layerPaths, colorMap) {
  const byColor = new Map();
  for (const p of layerPaths) {
    const d = p.markup.match(/ d="([^"]*)"/)?.[1];
    if (!d) continue;
    const fill = colorMap.get(p.fill) ?? p.fill;
    if (!byColor.has(fill)) byColor.set(fill, []);
    byColor.get(fill).push(d);
  }
  return [...byColor].map(([fill, ds]) => `<path d="${ds.join(' ')}" fill="${fill}" fill-rule="evenodd"/>`);
}

// All five layers, always listed, even when empty. The count is the number
// of shapes in the downloaded file (one per color in the layer).
export function groupSummary(paths, assign) {
  return GROUPS.map((g) => {
    const members = paths.filter((_, i) => assign[i] === g.key);
    const byColor = {};
    for (const p of members) byColor[p.fill] = (byColor[p.fill] || 0) + p.area;
    const ranked = Object.entries(byColor).sort((a, b) => b[1] - a[1]);
    return { ...g, count: Math.min(ranked.length, MAX_COLORS_PER_LAYER), swatch: ranked[0]?.[0] ?? null };
  });
}

function assignInside(paths, assign, box, group) {
  const boxArea = (box.x1 - box.x0) * (box.y1 - box.y0);
  paths.forEach((p, i) => {
    if (assign[i]) return;
    const b = p.box;
    if (b.x0 >= box.x0 && b.y0 >= box.y0 && b.x1 <= box.x1 && b.y1 <= box.y1 && p.area <= boxArea) assign[i] = group;
  });
}

function pad(b, f) {
  const px = (b.x1 - b.x0) * f;
  const py = (b.y1 - b.y0) * f;
  return { x0: b.x0 - px, y0: b.y0 - py, x1: b.x1 + px, y1: b.y1 + py };
}

function mergeBoxes(boxes, gap) {
  const out = boxes.map((b) => ({ ...b }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < out.length && !merged; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        if (a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1) {
          out[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
          out.splice(j, 1);
          merged = true;
          break;
        }
      }
    }
  }
  return out;
}

function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function chroma(rgb) {
  return Math.max(...rgb) - Math.min(...rgb);
}
function dist2(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

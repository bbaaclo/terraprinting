// Files for the By piece view.
//
// Layered SVG: one top-level layer per garment side (Front, Back), with a
// sub-layer per design layer (Color, Pattern, Trim, Logo, Name, Number) and,
// inside it, one group per piece (body, collar, left sleeve, right sleeve).
// Inkscape shows these as nested layers; Illustrator uses the ids
// (front-name, back-number, front-pattern-sleeve-left...).
//
// ZIP: one SVG per side and layer (front-name.svg...), each on the full
// canvas, so the files line up exactly when stacked again.
//
// Same color handling as the whole-design download: each layer keeps its
// 1 to 3 main colors and shapes of one color are joined into one path.
import { GROUPS, layerColorMap, mergeByColor } from './layers.js';
import { BODY } from './garmentTemplates.js';
import { zipFiles } from './patternSizes.js';

const SIDES = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'whole', label: 'Whole design' },
];
const PART_ORDER = [BODY.key, 'collar', 'sleeve-left', 'sleeve-right'];
const PART_LABEL = { body: 'Body', collar: 'Collar', 'sleeve-left': 'Left sleeve', 'sleeve-right': 'Right sleeve' };

export function buildPieceSvg(model) {
  const sides = [];
  for (const side of SIDES) {
    const layers = GROUPS.map((g) => layerGroup(model, side.key, g)).filter(Boolean);
    if (!layers.length) continue;
    sides.push(group(side.key, side.label, layers.join('\n')));
  }
  return svgFile(model, sides.join('\n'));
}

// [{ name, text }] for zipFiles(): one file per side and layer.
export function pieceFiles(model, baseName) {
  const files = [];
  for (const side of SIDES) {
    for (const g of GROUPS) {
      const layer = layerGroup(model, side.key, g);
      if (layer) files.push({ name: `${baseName}-${side.key}-${g.key}.svg`, text: svgFile(model, layer) });
    }
  }
  return files;
}

export function pieceZip(model, baseName) {
  return zipFiles(pieceFiles(model, baseName));
}

function layerGroup(model, side, g) {
  const shapes = model.shapes.filter((s) => s.piece === side && s.layer === g.key);
  if (!shapes.length) return null;
  const colorMap = layerColorMap(shapes);
  const parts = [...new Set(shapes.map((s) => s.part ?? BODY.key))]
    .sort((a, b) => rank(a) - rank(b))
    .map((part) => {
      const paths = mergeByColor(shapes.filter((s) => (s.part ?? BODY.key) === part), colorMap);
      return `<g id="${side}-${g.key}-${part}" inkscape:label="${PART_LABEL[part] ?? part}">\n${paths.join('\n')}\n</g>`;
    });
  return group(`${side}-${g.key}`, g.label, parts.join('\n'));
}

function group(id, label, inner) {
  return `<g id="${id}" inkscape:groupmode="layer" inkscape:label="${label}">\n${inner}\n</g>`;
}

function svgFile(model, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" width="${model.width}" height="${model.height}" viewBox="0 0 ${model.viewWidth} ${model.viewHeight}">\n${body}\n</svg>`;
}

function rank(part) {
  const i = PART_ORDER.indexOf(part);
  return i < 0 ? PART_ORDER.length : i;
}

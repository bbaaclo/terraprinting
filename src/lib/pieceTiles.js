// The tiles of the By piece view: one per layer for the chosen side (Front
// or Back), always in the same order. A layer with no shapes still gets a
// tile, marked empty, so staff can see what was not found and fix it by
// moving shapes. Each tile is a small SVG cropped to that side's garment,
// with the garment's pieces drawn as dashed outlines.
import { GROUPS } from './layers.js';

const PAD = 0.05; // space around the garment in a tile, as a share of its size

export function availableSides(model) {
  return ['front', 'back'].filter((side) => model.garments.some((g) => g.side === side));
}

export function buildTiles(model, side) {
  return GROUPS.map((g) => {
    const indexes = [];
    model.shapes.forEach((s, i) => { if (s.layer === g.key && s.piece === side) indexes.push(i); });
    return {
      key: `${side}-${g.key}`,
      layer: g.key,
      title: g.label,
      side,
      indexes,
      svg: indexes.length ? tileSvg(model, side, g.key, indexes) : null,
    };
  });
}

function tileSvg(model, side, layer, indexes) {
  const box = sideBox(model, side);
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const vb = [box.x0 - w * PAD, box.y0 - h * PAD, w * (1 + 2 * PAD), h * (1 + 2 * PAD)].map((n) => round(n)).join(' ');
  // Dashed outlines: the garment's base pieces (body, sleeves, collar).
  // Not drawn on the Jersey Base tile itself, where they are the content.
  const outline = layer === 'base' ? [] : model.shapes
    .map((s, i) => [s, i])
    .filter(([s]) => s.layer === 'base' && s.piece === side)
    .map(([s]) => s.markup.replace(/<path/, '<path class="tile-outline"').replace(/ fill="[^"]*"/, ' fill="none"'));
  const shapes = indexes.map((i) => {
    const s = model.shapes[i];
    const light = isLight(s.fill) ? ' class="is-light"' : '';
    return s.markup.replace('<path', `<path data-i="${i}"${light}`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${outline.join('')}${shapes.join('')}</svg>`;
}

function sideBox(model, side) {
  const boxes = model.garments.filter((g) => g.side === side).map((g) => g.box);
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

// White and near-white fills get a thin navy outline in the tiles only, so
// they show on the light checkerboard. Exported files keep them plain.
function isLight(hex) {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.82;
}

const round = (n) => Math.round(n * 100) / 100;

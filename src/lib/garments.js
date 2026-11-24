// Finds the garments in a traced design and tells front from back.
//
// The trace worker draws one smooth silhouette shape per separate garment in
// the image, so a design with the front and back side by side gives two big
// silhouette shapes. Their boxes are the garments.

import { flattenPath } from './cutting.js';

const MIN_GARMENT_SHARE = 0.04; // a garment covers at least 4% of the image

// silhouettePaths: shapes from readPaths() of the silhouette SVG.
// Returns garment boxes, left to right (or top to bottom when stacked).
export function findGarments(silhouettePaths, viewWidth, viewHeight) {
  const canvas = viewWidth * viewHeight;
  const boxes = silhouettePaths
    .filter((p) => p.area >= canvas * MIN_GARMENT_SHARE)
    .map((p) => ({ ...p.box }));
  const merged = mergeOverlapping(boxes);
  const sideBySide = merged.length < 2 || spread(merged, 'x') >= spread(merged, 'y');
  merged.sort((a, b) => (sideBySide ? a.x0 - b.x0 : a.y0 - b.y0));
  return merged;
}

// Which garment a shape belongs to: the one containing its center, else the
// nearest one. Returns -1 when there are no garments.
export function garmentOf(box, garments) {
  if (!garments.length) return -1;
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  let best = -1;
  let bestD = Infinity;
  garments.forEach((g, i) => {
    const inside = cx >= g.x0 && cx <= g.x1 && cy >= g.y0 && cy <= g.y1;
    const gx = (g.x0 + g.x1) / 2;
    const gy = (g.y0 + g.y1) / 2;
    const d = inside ? -1 : (cx - gx) ** 2 + (cy - gy) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

// Collar and sleeve bands: small shapes in an accent color sitting in the
// collar area (top middle) or at the sleeve ends (outer top corners) of a
// garment. Thin bands only, so logos and numbers are never caught.
export function isTrim(shape, garment) {
  if (!garment) return false;
  const gw = garment.x1 - garment.x0;
  const gh = garment.y1 - garment.y0;
  const b = shape.box;
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  if (!(w > 0 && h > 0)) return false;
  if (shape.area > gw * gh * 0.04) return false;
  // Thin: long and narrow, or (for a diagonal band, whose box is nearly
  // square) filling well under half of its box.
  const thin = Math.max(w, h) / Math.min(w, h) >= 2 || fillShare(shape) < 0.4;
  const cx = (b.x0 + b.x1) / 2 - garment.x0;
  const cy = (b.y0 + b.y1) / 2 - garment.y0;
  const collar = cx > gw * 0.3 && cx < gw * 0.7 && b.y0 - garment.y0 < gh * 0.12 && cy < gh * 0.18;
  const sleeve = (cx < gw * 0.22 || cx > gw * 0.78) && cy < gh * 0.45;
  return thin && (collar || sleeve);
}

// Front or back per garment.
// Two or more garments: the back is the one with the tallest number (back
// numbers are printed bigger); with no numbers, the one with the most name
// lettering; otherwise the second garment. One garment: front, because a
// single image is usually the front view; staff can change it.
export function sideOfGarments(garmentCount, shapes, shapeGarment) {
  if (garmentCount === 0) return [];
  if (garmentCount === 1) return ['front'];
  const tallestNumber = new Array(garmentCount).fill(0);
  const nameArea = new Array(garmentCount).fill(0);
  shapes.forEach((s, i) => {
    const g = shapeGarment[i];
    if (g < 0) return;
    if (s.layer === 'number') tallestNumber[g] = Math.max(tallestNumber[g], s.box.y1 - s.box.y0);
    if (s.layer === 'name') nameArea[g] += s.area;
  });
  let back = argmax(tallestNumber);
  if (back < 0) back = argmax(nameArea);
  if (back < 0) back = 1;
  return Array.from({ length: garmentCount }, (_, i) => (i === back ? 'back' : 'front'));
}

function argmax(values) {
  let best = -1;
  let bestV = 0;
  values.forEach((v, i) => { if (v > bestV) { bestV = v; best = i; } });
  // A tie for the top value is not a clear answer.
  if (best >= 0 && values.filter((v) => v === bestV).length > 1) return -1;
  return best;
}

function spread(boxes, axis) {
  const c = boxes.map((b) => (axis === 'x' ? b.x0 + b.x1 : b.y0 + b.y1) / 2);
  return Math.max(...c) - Math.min(...c);
}

function mergeOverlapping(boxes) {
  const out = boxes.map((b) => ({ ...b }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < out.length && !merged; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        if (a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1) {
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

// Share of its box that a shape really covers (holes subtract).
function fillShare(shape) {
  const d = shape.markup?.match(/ d="([^"]*)"/)?.[1];
  const rings = d ? flattenPath(d) : null;
  const boxArea = (shape.box.x1 - shape.box.x0) * (shape.box.y1 - shape.box.y0);
  if (!rings?.length || !(boxArea > 0)) return 1;
  let signed = 0;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) signed += ((r[j][0] + r[i][0]) * (r[j][1] - r[i][1])) / 2;
  }
  return Math.abs(signed) / boxArea;
}

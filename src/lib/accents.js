// Accent Elements: halftone dots, speckles and other small decorative shapes
// that appear in groups (a dot fade across the hem, a scatter of small
// geometric bits). One lone small shape is just a detail of the pattern;
// many small, compact shapes close together are an accent. Thin slivers
// (broken pieces of a letter outline, scratches) never count.
//
import { fillShare } from './garments.js';

// Shapes are linked when they sit within a few shape-widths of each other;
// each linked group with enough members becomes Accent Elements.

const MAX_SHARE = 0.002;   // an accent shape covers under 0.2% of its garment
const MIN_GROUP = 12;      // at least this many small shapes form an accent
const LINK = 3;            // linked when the gap is under 3 x the typical size
const MAX_ASPECT = 2.5;    // dots and small bits are compact, not long slivers
const MIN_FILL = 0.35;     // and fill a good part of their box (a ring or a
                           // fragment of a letter outline does not)
const MAX_SPREAD = 0.5;    // a group's shapes are similar in size (dots of one
                           // halftone); broken letter pieces vary far more

// paths: traced shapes ({ box, area }); candidates: indexes that may be
// accents (not yet in another layer). garmentArea(i): area of the garment
// the shape is on (or the canvas when there is none).
// Returns the set of indexes that are accent elements.
export function findAccents(paths, candidates, garmentArea) {
  const small = candidates.filter((i) => {
    const p = paths[i];
    if (!(p.area > 0) || p.area >= garmentArea(i) * MAX_SHARE) return false;
    const w = p.box.x1 - p.box.x0;
    const h = p.box.y1 - p.box.y0;
    return Math.max(w, h) / Math.max(Math.min(w, h), 1e-9) <= MAX_ASPECT && fillShare(p) >= MIN_FILL;
  });
  if (small.length < MIN_GROUP) return new Set();

  const sizes = small.map((i) => Math.sqrt(paths[i].area)).sort((a, b) => a - b);
  const typical = sizes[Math.floor(sizes.length / 2)];
  const reach = typical * LINK;

  // Grid buckets so each shape only checks its neighbours.
  const cell = Math.max(reach, 1);
  const grid = new Map();
  const centre = (i) => [(paths[i].box.x0 + paths[i].box.x1) / 2, (paths[i].box.y0 + paths[i].box.y1) / 2];
  small.forEach((i) => {
    const [x, y] = centre(i);
    const key = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  });

  // Groups of linked shapes (union-find).
  const parent = new Map(small.map((i) => [i, i]));
  const find = (i) => { while (parent.get(i) !== i) { parent.set(i, parent.get(parent.get(i))); i = parent.get(i); } return i; };
  for (const i of small) {
    const [x, y] = centre(i);
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
          if (j <= i || gap(paths[i].box, paths[j].box) > reach) continue;
          parent.set(find(i), find(j));
        }
      }
    }
  }
  const groups = new Map();
  for (const i of small) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }
  const out = new Set();
  for (const members of groups.values()) {
    if (members.length >= MIN_GROUP && sizeSpread(members.map((i) => Math.sqrt(paths[i].area))) <= MAX_SPREAD) {
      members.forEach((i) => out.add(i));
    }
  }
  return out;
}

// Coefficient of variation of the sizes: 0 when all are the same size.
function sizeSpread(sizes) {
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const sd = Math.sqrt(sizes.reduce((a, b) => a + (b - mean) ** 2, 0) / sizes.length);
  return mean > 0 ? sd / mean : 0;
}

function gap(a, b) {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return Math.hypot(dx, dy);
}

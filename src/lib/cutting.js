// Cuts traced shapes along garment piece outlines (sleeves, collar, body).
//
// A shape that sits inside one piece is kept exactly as traced. Only shapes
// that cross a seam (a stripe running from the body onto a sleeve, the
// garment's base color) are cut. Their curves are turned into fine straight
// segments for the cut, and each piece of the shape becomes its own plain
// filled path, so the files stay safe for Photoshop.
import polygonClipping from 'polygon-clipping';
import { BODY } from './garmentTemplates.js';

const CURVE_STEPS = 8;        // straight segments per curve when cutting
const MIN_PIECE_AREA = 0.5;   // in design units; smaller pieces are rounding noise
const DECIMALS = 2;

// parts: from placeTemplate(), in priority order. Returns one or more
// { part, markup, box, area } for the shape; part is a part key or 'body'.
export function cutShape(shape, parts) {
  const b = shape.box;
  const touching = parts.filter((p) => boxesOverlap(b, ringBox(p.ring)));
  if (!touching.length) return [keep(shape, BODY.key)];
  if (touching.length === 1 && boxCorners(b).every((pt) => insideRing(pt, touching[0].ring))) {
    return [keep(shape, touching[0].key)];
  }

  const d = shape.markup.match(/ d="([^"]*)"/)?.[1];
  const rings = d ? flattenPath(d) : null;
  if (!rings || !rings.length) return [keep(shape, BODY.key)]; // unreadable: leave it whole

  let rest = evenOdd(rings);
  const total = geomArea(rest);
  if (!(total > 0)) return [keep(shape, BODY.key)];
  const pieces = [];
  for (const part of touching) {
    const ring = [part.ring];
    const inside = polygonClipping.intersection(rest, ring);
    rest = polygonClipping.difference(rest, ring);
    pieces.push({ part: part.key, geom: inside, area: geomArea(inside) });
  }
  pieces.push({ part: BODY.key, geom: rest, area: geomArea(rest) });

  // Every real piece is kept, however thin, so no ink is lost at a seam.
  const real = pieces.filter((p) => p.area >= MIN_PIECE_AREA);
  if (real.length <= 1) return [keep(shape, real[0]?.part ?? BODY.key)];
  return real.map((p) => {
    const box = geomBox(p.geom);
    return {
      part: p.part,
      markup: `<path d="${geomToD(p.geom)}" fill="${shape.fill}" fill-rule="evenodd"/>`,
      box,
      area: (box.x1 - box.x0) * (box.y1 - box.y0),
    };
  });
}

function keep(shape, part) {
  return { part, markup: shape.markup, box: shape.box, area: shape.area };
}

// ---- SVG path to rings of points (M, L, H, V, C, S, Q, T, Z; abs or rel) ----
export function flattenPath(d) {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtZzAa]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return null;
  const rings = [];
  let ring = null;
  let x = 0; let y = 0; let sx = 0; let sy = 0;
  let lastCtrl = null; let lastQ = null;
  let cmd = null;
  let i = 0;
  const num = () => {
    const v = Number(tokens[i++]);
    if (!Number.isFinite(v)) throw new Error('bad number');
    return v;
  };
  const closeRing = () => { if (ring && ring.length >= 3) rings.push(ring); ring = null; };
  const lineTo = (nx, ny) => { if (!ring) ring = [[x, y]]; ring.push([nx, ny]); x = nx; y = ny; };
  try {
    while (i < tokens.length) {
      if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
      else if (!cmd) return null;
      const rel = cmd === cmd.toLowerCase();
      const ox = rel ? x : 0; const oy = rel ? y : 0;
      switch (cmd.toUpperCase()) {
        case 'M': {
          closeRing();
          x = ox + num(); y = oy + num(); sx = x; sy = y;
          ring = [[x, y]];
          cmd = rel ? 'l' : 'L'; // extra pairs after M are lines
          lastCtrl = lastQ = null;
          break;
        }
        case 'L': lineTo(ox + num(), oy + num()); lastCtrl = lastQ = null; break;
        case 'H': lineTo(ox + num(), y); lastCtrl = lastQ = null; break;
        case 'V': lineTo(x, oy + num()); lastCtrl = lastQ = null; break;
        case 'C': {
          const c1 = [ox + num(), oy + num()]; const c2 = [ox + num(), oy + num()]; const e = [ox + num(), oy + num()];
          cubic([x, y], c1, c2, e, lineTo); lastCtrl = c2; lastQ = null; break;
        }
        case 'S': {
          const c1 = lastCtrl ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y];
          const c2 = [ox + num(), oy + num()]; const e = [ox + num(), oy + num()];
          cubic([x, y], c1, c2, e, lineTo); lastCtrl = c2; lastQ = null; break;
        }
        case 'Q': {
          const c = [ox + num(), oy + num()]; const e = [ox + num(), oy + num()];
          quad([x, y], c, e, lineTo); lastQ = c; lastCtrl = null; break;
        }
        case 'T': {
          const c = lastQ ? [2 * x - lastQ[0], 2 * y - lastQ[1]] : [x, y];
          const e = [ox + num(), oy + num()];
          quad([x, y], c, e, lineTo); lastQ = c; lastCtrl = null; break;
        }
        case 'Z': x = sx; y = sy; closeRing(); lastCtrl = lastQ = null; cmd = null; break;
        default: return null; // arcs are not produced by the tracer
      }
    }
  } catch {
    return null;
  }
  closeRing();
  return rings;
}

function cubic(p0, p1, p2, p3, lineTo) {
  for (let s = 1; s <= CURVE_STEPS; s++) {
    const t = s / CURVE_STEPS; const u = 1 - t;
    lineTo(
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    );
  }
}

function quad(p0, p1, p2, lineTo) {
  for (let s = 1; s <= CURVE_STEPS; s++) {
    const t = s / CURVE_STEPS; const u = 1 - t;
    lineTo(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]);
  }
}

// Even-odd fill: a ring inside another is a hole, as in the traced file.
function evenOdd(rings) {
  const polys = rings.map((r) => [[r]]);
  return polys.length === 1 ? polys[0] : polygonClipping.xor(...polys);
}

// ---- Geometry helpers (polygon-clipping MultiPolygon: [[outer, ...holes]]) ----
function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(a / 2);
}

function geomArea(g) {
  return g.reduce((sum, poly) => sum + ringArea(poly[0]) - poly.slice(1).reduce((h, r) => h + ringArea(r), 0), 0);
}

function geomBox(g) {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const poly of g) for (const [px, py] of poly[0]) {
    box.x0 = Math.min(box.x0, px); box.y0 = Math.min(box.y0, py);
    box.x1 = Math.max(box.x1, px); box.y1 = Math.max(box.y1, py);
  }
  return box;
}

function geomToD(g) {
  const f = (v) => Number(v.toFixed(DECIMALS));
  return g.flatMap((poly) => poly.map((ring) => {
    const pts = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
    return `M${pts.map(([px, py]) => `${f(px)},${f(py)}`).join('L')}Z`;
  })).join('');
}

function ringBox(r) {
  const xs = r.map((p) => p[0]); const ys = r.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function boxesOverlap(a, b) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

function boxCorners(b) {
  return [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];
}

export function insideRing([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

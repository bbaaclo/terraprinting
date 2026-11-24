// The design model every feature reads: the traced shapes, which layer each
// shape is in (Color, Pattern, Logo, Name, Number) and which garment piece
// it belongs to (front, back, sleeves, collar).
//
// Until a garment template is chosen, every shape sits in one piece,
// "whole", so the design behaves exactly like the plain layered result.
// Later steps add templates that split shapes into real pieces; auto naming,
// sizing and export then read pieces from here instead of re-tracing.
//
// The model is never changed in place: every edit returns a new model, so
// React sees the change and older copies stay valid.

export const PIECES = [
  { key: 'whole', label: 'Whole design' },
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'sleeve-left', label: 'Left sleeve' },
  { key: 'sleeve-right', label: 'Right sleeve' },
  { key: 'collar', label: 'Collar' },
];

import { garmentOf, sideOfGarments } from './garments.js';
import { placeTemplate } from './garmentTemplates.js';
import { cutShape } from './cutting.js';

export const WHOLE = 'whole';

// data: { paths, viewWidth, viewHeight } and assign: layer key per path,
// as returned by classify() in layers.js. width/height: the output size.
export function createModel(data, assign, width, height) {
  return {
    width,
    height,
    viewWidth: data.viewWidth,
    viewHeight: data.viewHeight,
    garment: null,     // garment template key, set when a template is chosen
    garments: [],      // [{ box, side }] found by placePieces()
    pieces: [WHOLE],
    shapes: data.paths.map((p, i) => ({
      markup: p.markup,
      fill: p.fill,
      box: p.box,
      area: p.area,
      layer: assign[i] ?? null,
      piece: WHOLE,
      part: null,      // 'body', 'collar', 'sleeve-left'... once a template is applied
    })),
  };
}

// Moves one shape to another layer. index is the shape's position in
// model.shapes (the same number the preview puts on each shape).
export function moveShapeToLayer(model, index, layer) {
  if (!model.shapes[index] || model.shapes[index].layer === layer) return model;
  const shapes = model.shapes.slice();
  shapes[index] = { ...shapes[index], layer };
  return { ...model, shapes };
}

// The { data, assign } pair that buildLayeredSvg, groupSummary and the
// Layers panel already use. Shape order and numbering are kept, so the
// index of a shape is the same in both. Pass a piece key to keep only that
// piece's shapes in the result (the others get no layer, so they are left
// out of the SVG but keep their numbers).
export function toLayers(model, piece = null) {
  const data = {
    paths: model.shapes.map(({ markup, fill, box, area }) => ({ markup, fill, box, area })),
    viewWidth: model.viewWidth,
    viewHeight: model.viewHeight,
  };
  const assign = model.shapes.map((s) => (piece && s.piece !== piece ? null : s.layer));
  return { data, assign };
}

// Indexes of the shapes in a piece and/or layer.
export function shapeIndexes(model, { piece = null, layer = null } = {}) {
  const out = [];
  model.shapes.forEach((s, i) => {
    if (piece && s.piece !== piece) return;
    if (layer && s.layer !== layer) return;
    out.push(i);
  });
  return out;
}

// Splits the design into the garments found by classify() and tags each
// one front or back. Every shape goes to the garment it sits in.
// With no garments found, the model is returned unchanged ("whole").
export function placePieces(model, garmentBoxes) {
  if (!garmentBoxes?.length) return model;
  const shapeGarment = model.shapes.map((s) => garmentOf(s.box, garmentBoxes));
  const sides = sideOfGarments(garmentBoxes.length, model.shapes, shapeGarment);
  // Two garments on the same side (rare: e.g. two fronts) keep "front".
  const shapes = model.shapes.map((s, i) => ({ ...s, piece: shapeGarment[i] >= 0 ? sides[shapeGarment[i]] : WHOLE }));
  const pieces = [...new Set(shapes.map((s) => s.piece))];
  return {
    ...model,
    garments: garmentBoxes.map((box, i) => ({ box, side: sides[i] })),
    pieces,
    shapes,
  };
}

// Changes which side a garment is (staff correcting front/back).
export function setGarmentSide(model, garmentIndex, side) {
  const g = model.garments[garmentIndex];
  if (!g || g.side === side) return model;
  const garments = model.garments.map((x, i) => (i === garmentIndex ? { ...x, side } : x));
  const boxes = model.garments.map((x) => x.box);
  const shapes = model.shapes.map((s) => (garmentOf(s.box, boxes) === garmentIndex ? { ...s, piece: side } : s));
  return { ...model, garments, shapes, pieces: [...new Set(shapes.map((s) => s.piece))] };
}

// Cuts every garment along a piece template (see garmentTemplates.js and
// cutting.js). Shapes inside one part keep their traced outline; shapes
// crossing a seam are split, one shape per part, each keeping its layer.
// Choosing another template later re-cuts from the shapes before any cut,
// so cuts never pile up. Layer moves made after a cut are kept only for
// shapes that were not split.
export function applyTemplate(model, template) {
  const source = model.uncut ?? model.shapes;
  if (!template || !model.garments.length) {
    return { ...model, garment: template?.key ?? null, uncut: null, shapes: source };
  }
  const boxes = model.garments.map((g) => g.box);
  const placed = boxes.map((box) => placeTemplate(template, box));
  const shapes = [];
  for (const s of source) {
    const g = garmentOf(s.box, boxes);
    if (g < 0) { shapes.push({ ...s, part: null }); continue; }
    for (const piece of cutShape(s, placed[g])) {
      shapes.push({ ...s, markup: piece.markup, box: piece.box, area: piece.area, part: piece.part });
    }
  }
  return { ...model, garment: template.key, uncut: source, shapes };
}

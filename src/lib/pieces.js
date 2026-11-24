// The design model every feature reads: the traced shapes, which layer each
// shape is in (Color, Pattern, Logo, Name, Number) and which garment piece
// it belongs to (front, back, sleeves, collar).
//
// Until a garment template is chosen, every shape sits in one piece,
// "whole", so the design behaves exactly like the plain five-layer result.
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

export const WHOLE = 'whole';

// data: { paths, viewWidth, viewHeight } and assign: layer key per path,
// as returned by classify() in layers.js. width/height: the output size.
export function createModel(data, assign, width, height) {
  return {
    width,
    height,
    viewWidth: data.viewWidth,
    viewHeight: data.viewHeight,
    garment: null,
    pieces: [WHOLE],
    shapes: data.paths.map((p, i) => ({
      markup: p.markup,
      fill: p.fill,
      box: p.box,
      area: p.area,
      layer: assign[i] ?? null,
      piece: WHOLE,
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

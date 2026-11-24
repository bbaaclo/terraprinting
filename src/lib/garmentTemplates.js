// Piece templates: where the sleeves and collar sit on each garment type.
// The body is everything else, so it needs no outline of its own.
//
// Points are fractions of the garment's box (0 = left/top edge, 1 = right/
// bottom edge), so one template fits any image size. Order matters: a shape
// is checked against the parts in this order, and the first part that
// covers an area gets it.
//
// PLACEHOLDERS: these follow a typical cut until Terra Printing shares its
// real pattern files. They are saved with the shop's data (store.js), so
// Admin can replace them later without a code change.

export const DEFAULT_TEMPLATES = [
  {
    key: 'jersey',
    label: 'Jersey',
    parts: [
      { key: 'collar', label: 'Collar', polygon: [[0.38, 0], [0.62, 0], [0.6, 0.11], [0.5, 0.16], [0.4, 0.11]] },
      { key: 'sleeve-left', label: 'Left sleeve', polygon: [[0, 0.2], [0.27, 0.04], [0.27, 0.3], [0.14, 0.38]] },
      { key: 'sleeve-right', label: 'Right sleeve', polygon: [[1, 0.2], [0.73, 0.04], [0.73, 0.3], [0.86, 0.38]] },
    ],
  },
  {
    key: 'tshirt',
    label: 'T-shirt',
    parts: [
      { key: 'collar', label: 'Collar', polygon: [[0.36, 0], [0.64, 0], [0.61, 0.08], [0.5, 0.11], [0.39, 0.08]] },
      { key: 'sleeve-left', label: 'Left sleeve', polygon: [[0, 0.24], [0.25, 0.02], [0.25, 0.33], [0.12, 0.42]] },
      { key: 'sleeve-right', label: 'Right sleeve', polygon: [[1, 0.24], [0.75, 0.02], [0.75, 0.33], [0.88, 0.42]] },
    ],
  },
  {
    // A singlet has no sleeves; the armhole bands are part of the body.
    key: 'singlet',
    label: 'Singlet',
    parts: [
      { key: 'collar', label: 'Collar', polygon: [[0.32, 0], [0.68, 0], [0.64, 0.14], [0.5, 0.2], [0.36, 0.14]] },
    ],
  },
];

export const BODY = { key: 'body', label: 'Body' };

export function findTemplate(templates, key) {
  return (templates ?? DEFAULT_TEMPLATES).find((t) => t.key === key) ?? null;
}

// Template part outlines placed on one garment box, in design coordinates.
export function placeTemplate(template, box) {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  return template.parts.map((part) => ({
    key: part.key,
    label: part.label,
    ring: part.polygon.map(([fx, fy]) => [box.x0 + fx * w, box.y0 + fy * h]),
  }));
}

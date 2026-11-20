// Turns VTracer's raw output into the SVG we hand to staff:
// plain <path> elements with fills, plus explicit width, height and viewBox
// so Photoshop opens it at the right size.
//
// VTracer slightly blends the color of some shapes where they meet others,
// which would give near-duplicate fills (#FFFFFF, #FEFDFD, #FCFCFB...).
// Every fill is snapped back to the nearest palette color, so the SVG has
// exactly the colors the design was reduced to.

export function finalizeSvg(rawSvg, width, height, palette = [], viewWidth = width, viewHeight = height) {
  const svgTag = /<svg\b[^>]*>/;
  const match = rawSvg.match(svgTag);
  if (!match) throw new Error('The tracer returned an empty result.');
  const openTag = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${viewWidth} ${viewHeight}">`;
  let body = rawSvg.slice(match.index + match[0].length);
  if (palette.length) {
    body = body.replace(/fill="#([0-9a-fA-F]{6})"/g, (_, hex) => `fill="${snapToPalette(hex, palette)}"`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${openTag}${body}`;
}

export function svgStats(svg) {
  const fills = svg.match(/fill="[^"]*"/g) ?? [];
  return {
    shapes: (svg.match(/<path\b/g) ?? []).length,
    colors: new Set(fills.map((f) => f.toLowerCase())).size,
  };
}

// For showing inside the page: drop the XML declaration.
export function inlineSvg(svg) {
  return svg.replace(/^<\?xml[^>]*>\s*/, '');
}

export function svgFileName(imageName) {
  const base = imageName.replace(/\.[^.]+$/, '') || 'design';
  return `${base}.svg`;
}

function snapToPalette(hex, palette) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  let best = palette[0];
  let bestD = Infinity;
  for (const c of palette) {
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return '#' + best.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

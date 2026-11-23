// Makes one SVG per size from a single pattern SVG.
//
// Each generated file keeps the pattern's artwork and layers exactly as they
// are, and only sets the file's real-world size: width and height in cm.
// preserveAspectRatio="none" stretches the artwork to that width and height,
// so opening it in Illustrator or Photoshop gives a design of exactly that
// size. Proportions change only as much as the size's width and height do.

export function readPattern(text, name) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (doc.querySelector('parsererror') || svg.nodeName.toLowerCase() !== 'svg') {
    throw new Error('This file is not a readable SVG.');
  }
  let vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) {
    const w = parseFloat(svg.getAttribute('width'));
    const h = parseFloat(svg.getAttribute('height'));
    if (!(w > 0 && h > 0)) throw new Error('The SVG has no size (no viewBox, width or height), so it cannot be scaled.');
    vb = [0, 0, w, h];
  }
  if (!svg.querySelector('path, rect, circle, ellipse, polygon, polyline, line, text, image, use')) {
    throw new Error('The SVG has no shapes in it.');
  }
  return { name: name.replace(/\.svg$/i, ''), text, viewBox: vb, layers: svg.querySelectorAll(':scope > g').length };
}

export function makeSize(pattern, widthCm, heightCm) {
  const doc = new DOMParser().parseFromString(pattern.text, 'image/svg+xml');
  const svg = doc.documentElement;
  svg.setAttribute('viewBox', pattern.viewBox.join(' '));
  svg.setAttribute('width', `${round(widthCm)}cm`);
  svg.setAttribute('height', `${round(heightCm)}cm`);
  svg.setAttribute('preserveAspectRatio', 'none');
  if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
}

const round = (n) => Math.round(n * 100) / 100;

// ---- Minimal ZIP writer (files stored without compression) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipFiles(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.text);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true);      // stored
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), name, data);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, dosTime, true);
    cen.setUint16(14, dosDate, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, data.length, true);
    cen.setUint32(24, data.length, true);
    cen.setUint16(28, name.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((a, c) => a + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

// A small layered jersey pattern for trying the generator without a file.
export const SAMPLE_PATTERN = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="240" height="290" viewBox="0 0 240 290">
<defs><clipPath id="body"><path d="M72 22C88 46 152 46 168 22L198 32C194 72 204 98 222 112L222 272L18 272L18 112C36 98 46 72 42 32Z"/></clipPath></defs>
<g id="Color" inkscape:groupmode="layer" inkscape:label="Color"><path d="M72 22C88 46 152 46 168 22L198 32C194 72 204 98 222 112L222 272L18 272L18 112C36 98 46 72 42 32Z" fill="#2F4FA3"/></g>
<g id="Pattern" inkscape:groupmode="layer" inkscape:label="Pattern" clip-path="url(#body)"><path d="M-20 300L120 120L160 120L20 300Z" fill="#EC8233"/><path d="M40 300L180 120L200 120L60 300Z" fill="#F0AF3D"/><path d="M72 22C88 46 152 46 168 22L198 32C194 72 204 98 222 112L222 272L18 272L18 112C36 98 46 72 42 32Z" fill="none" stroke="#F0AF3D" stroke-width="9"/></g>
<g id="Logo" inkscape:groupmode="layer" inkscape:label="Logo"><g transform="translate(146 62)"><path d="M4 6l10 5v10L4 26z" fill="#EC8233"/><path d="M28 6L18 11v10l10 5z" fill="#FFFFFF"/></g></g>
<g id="Name" inkscape:groupmode="layer" inkscape:label="Name"><path d="M86 98h68v8h-30v24h-8v-24h-30z" fill="#FFFFFF"/></g>
<g id="Number" inkscape:groupmode="layer" inkscape:label="Number"><path d="M96 150h48v8h-20v66h-8v-66h-20z" fill="#FFFFFF"/></g>
</svg>`;

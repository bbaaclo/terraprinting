// Finds words (names, numbers, team text) with tesseract.js, running in the
// browser from files served by this app (public/ocr). Nothing is uploaded.
import { createWorker } from 'tesseract.js';

let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/core',
      langPath: '/ocr/lang',
      workerBlobURL: false,
      cacheMethod: 'none',
    })
      // Sparse-text mode: finds words scattered over a design, not in lines.
      .then(async (w) => { await w.setParameters({ tessedit_pageseg_mode: '11' }); return w; })
      .catch((err) => { workerPromise = null; throw err; });
  }
  return workerPromise;
}

// pixels: { rgba, width, height } in the same coordinates as the SVG viewBox.
// Reads the design twice: once for dark lettering (black or navy text on a
// light shirt) and once for light lettering (white names and numbers on a
// dark shirt, the usual jersey look). Each pass turns its ink black on
// white paper, which is what the text reader handles best. Words found by
// both passes are kept once.
export async function findWords({ rgba, width, height }) {
  const worker = await getWorker();
  const words = [];
  for (const ink of ['dark', 'light']) {
    const { data } = await worker.recognize(inkCanvas(rgba, width, height, ink), {}, { blocks: true, text: false });
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          for (const w of line.words ?? []) words.push({ text: w.text, confidence: w.confidence, bbox: w.bbox });
        }
      }
    }
  }
  return dedupe(words);
}

// Black where the chosen ink is, white everywhere else (including the
// removed background, which is never ink).
// Dark ink: busy patterns and light fabric drop out. Light ink: the
// shirt's dark base drops out and white or pale lettering stays.
function inkCanvas(rgba, width, height, ink) {
  const mask = inkMask(rgba, width, height, ink);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const d = img.data;
  for (let p = 0; p < mask.length; p++) {
    const v = mask[p] ? 0 : 255;
    d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = v;
    d[p * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// 1 where a pixel is ink. For light ink, light areas touching the image
// edge are the paper or backdrop around the design, not lettering, so they
// are cleared (when the background was kept, it is usually white).
export function inkMask(rgba, width, height, ink) {
  const mask = new Uint8Array(width * height);
  for (let p = 0; p < mask.length; p++) {
    const i = p * 4;
    const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    mask[p] = rgba[i + 3] >= 128 && (ink === 'dark' ? lum < 110 : lum > 200) ? 1 : 0;
  }
  if (ink === 'light') {
    const stack = [];
    const push = (p) => { if (mask[p]) { mask[p] = 0; stack.push(p); } };
    for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
    for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1); }
    while (stack.length) {
      const p = stack.pop();
      const x = p % width;
      if (x > 0) push(p - 1);
      if (x < width - 1) push(p + 1);
      if (p >= width) push(p - width);
      if (p < mask.length - width) push(p + width);
    }
  }
  return mask;
}

// The same word found by both passes: keep the more confident reading.
export function dedupe(words) {
  const kept = [];
  for (const w of [...words].sort((a, b) => b.confidence - a.confidence)) {
    if (!kept.some((k) => overlap(k.bbox, w.bbox) > 0.5)) kept.push(w);
  }
  return kept;
}

function overlap(a, b) {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const inter = ix * iy;
  const smaller = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return smaller > 0 ? inter / smaller : 0;
}

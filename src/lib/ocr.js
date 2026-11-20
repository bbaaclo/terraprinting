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
export async function findWords({ rgba, width, height }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparent areas read as white paper
  ctx.fillRect(0, 0, width, height);
  const tmp = document.createElement('canvas');
  tmp.width = width;
  tmp.height = height;
  tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer.slice(0)), width, height), 0, 0);
  ctx.drawImage(tmp, 0, 0);

  // Keep only dark ink (black on white). Busy patterns and light fabric
  // drop out, which made names and numbers much easier to read in testing.
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = lum < 110 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);

  const worker = await getWorker();
  const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false });
  const words = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const w of line.words ?? []) {
          words.push({ text: w.text, confidence: w.confidence, bbox: w.bbox });
        }
      }
    }
  }
  return words;
}

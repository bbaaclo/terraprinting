// Client for the smart recognition worker (regions.worker.js). Returns
// { words, logos }: text lines and logo boxes in the pixels' coordinates.
// One result per image is kept, so changing settings does not run the
// model again. Errors carry a code: no-webgpu, no-f16, no-model, failed.

let worker = null;
let nextId = 1;
const pending = new Map();
const cache = new WeakMap();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./regions.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      if (data.phase) { job.onPhase?.(data.phase); return; }
      pending.delete(data.id);
      if (data.error) {
        const err = new Error(data.error);
        err.code = data.code;
        job.reject(err);
      } else {
        job.resolve(data.result);
      }
    };
    worker.onerror = (event) => {
      const err = new Error(event.message || 'Smart recognition stopped unexpectedly.');
      err.code = 'failed';
      pending.forEach((job) => job.reject(err));
      pending.clear();
      resetWorker();
    };
  }
  return worker;
}

function resetWorker() {
  if (worker) worker.terminate();
  worker = null;
}

export function getAiRegions(pixels, onPhase) {
  const cached = cache.get(pixels);
  if (cached) return cached;
  const id = nextId++;
  const copy = pixels.rgba.slice();
  const promise = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onPhase });
    getWorker().postMessage({ id, rgba: copy, width: pixels.width, height: pixels.height }, [copy.buffer]);
  });
  cache.set(pixels, promise);
  // What the model found, for checking results in the browser console (F12).
  promise.then((r) => console.info('Smart recognition found:', {
    text: r.words.map((w) => `${w.text} @ ${boxText(w.bbox)}`),
    logos: r.logos.map((l) => boxText(l.bbox)),
  }), () => {});
  promise.catch((err) => {
    cache.delete(pixels);
    console.error('Smart recognition failed:', err.message);
    if (err.code === 'failed') resetWorker();
  });
  return promise;
}

const boxText = (b) => `${Math.round(b.x0)},${Math.round(b.y0)} to ${Math.round(b.x1)},${Math.round(b.y1)}`;

// Turns the model's answer into what classify() reads: words (merged with
// the basic text reader's words, keeping each word once) and logo boxes.
// The model gives no confidence score, so its words count as confident.
const AI_CONFIDENCE = 90;
export function mergeRegions(basicWords, regions) {
  const aiWords = (regions?.words ?? [])
    .map((w) => ({ text: w.text.trim(), confidence: AI_CONFIDENCE, bbox: w.bbox, source: 'ai' }))
    .filter((w) => w.text);
  return { words: [...aiWords, ...basicWords], logos: (regions?.logos ?? []).map((l) => l.bbox) };
}

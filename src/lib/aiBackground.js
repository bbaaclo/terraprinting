// Client for the AI worker. Keeps one mask per image, so switching the
// background setting back and forth does not run the model again.
const MIN_SHARE = 0.01;  // design must cover at least 1% of the image
const MAX_SHARE = 0.98;  // and leave at least 2% as background

let worker = null;
let nextId = 1;
const pending = new Map();
const cache = new WeakMap();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      if (data.phase) { job.onPhase?.(data.phase, data.progress); return; }
      pending.delete(data.id);
      if (data.error) {
        const err = new Error(data.error);
        err.code = data.code;
        job.reject(err);
      } else {
        job.resolve(data.mask);
      }
    };
    worker.onerror = (event) => {
      const err = new Error(event.message || 'The AI stopped unexpectedly.');
      err.code = 'failed';
      pending.forEach((job) => job.reject(err));
      pending.clear();
      worker.terminate();
      worker = null;
    };
  }
  return worker;
}

// Starts downloading and preparing the AI model in the background, so it is
// ready (or nearly) by the time an image is uploaded. Only once per page load.
let warmed = false;
export function warmUpAi() {
  if (warmed || !('gpu' in navigator)) return;
  warmed = true;
  getWorker().postMessage({ type: 'warm' });
}

function resetWorker() {
  if (worker) worker.terminate();
  worker = null;
  warmed = false;
}

// Runs the model; after a crash it starts a fresh worker (a crashed
// WebAssembly instance cannot be reused) and tries once more.
export function getAiMask(pixels, onPhase) {
  const cached = cache.get(pixels);
  if (cached) return cached;
  const promise = runOnce(pixels, onPhase).catch((err) => {
    if (err.code !== 'failed') throw err;
    console.warn('Smart removal failed, retrying with a fresh worker:', err.message);
    resetWorker();
    return runOnce(pixels, onPhase);
  });
  cache.set(pixels, promise);
  promise.catch((err) => {
    cache.delete(pixels);
    console.error('Smart removal failed:', err.message);
    resetWorker();
  });
  return promise;
}

function runOnce(pixels, onPhase) {
  const id = nextId++;
  const copy = pixels.rgba.slice();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onPhase });
    getWorker().postMessage({ id, rgba: copy, width: pixels.width, height: pixels.height }, [copy.buffer]);
  });
}

// Returns a copy of the pixels with the background made transparent,
// or { usable: false } when the mask looks wrong.
export function applyMask(pixels, mask) {
  const { rgba, width, height } = pixels;
  let kept = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] >= 128 && rgba[i * 4 + 3] >= 128) kept++;
  const share = kept / mask.length;
  if (share < MIN_SHARE || share > MAX_SHARE) return { usable: false };
  const out = rgba.slice();
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < 128) {
      const j = i * 4;
      out[j] = out[j + 1] = out[j + 2] = out[j + 3] = 0;
    }
  }
  return { usable: true, pixels: { rgba: out, width, height }, removedShare: 1 - share };
}

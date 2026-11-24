// Smart (AI) background removal. Runs the BiRefNet-lite model on the GPU
// (WebGPU) inside a worker and returns a mask: 255 where the design is,
// 0 where the background is. The image never leaves the computer.
import * as ort from 'onnxruntime-web/webgpu';

const MODEL_URL = '/models/birefnet-lite-768.onnx';
const SIZE = 768; // the model's fixed input size
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

// Only the .wasm file is loaded from public/ort. The JavaScript glue is
// already inside the onnxruntime-web bundle; pointing to a separate .mjs in
// public/ breaks under the Vite dev server ("should not be imported").
ort.env.wasm.wasmPaths = { wasm: '/ort/ort-wasm-simd-threaded.asyncify.wasm' };
ort.env.wasm.numThreads = 1;
ort.env.logLevel = 'error';

const MODEL_BYTES = 104329641; // expected size, for progress when the server does not say
const CACHE_NAME = 'terra-ai-model-v1';

let sessionPromise = null;
const listeners = new Set(); // progress callbacks of everyone waiting for the model
const broadcast = (phase, progress) => listeners.forEach((l) => l(phase, progress));

// Gets the model bytes: from the browser's cache after the first visit,
// otherwise downloaded once with progress, then saved to the cache.
async function loadModelBytes() {
  let cache = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(MODEL_URL);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
  } catch { /* no Cache Storage here: just download */ }

  const res = await fetch(MODEL_URL);
  const type = res.headers.get('content-type') || '';
  if (!res.ok || type.includes('text/html') || !res.body) {
    throw codeError('no-model', 'The AI model file is missing.');
  }
  const total = Number(res.headers.get('content-length')) || MODEL_BYTES;
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  let shown = -1;
  broadcast('loading', 0);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const pct = Math.min(99, Math.floor((received / total) * 100));
    if (pct !== shown) { shown = pct; broadcast('loading', pct); }
  }
  const bytes = new Uint8Array(received);
  let at = 0;
  for (const c of chunks) { bytes.set(c, at); at += c.length; }
  try { await cache?.put(MODEL_URL, new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } })); } catch { /* storage full: fine */ }
  return bytes;
}

function getSession(report) {
  listeners.add(report);
  if (!sessionPromise) {
    sessionPromise = (async () => {
      if (!('gpu' in navigator) || !(await navigator.gpu.requestAdapter())) {
        throw codeError('no-webgpu', 'This browser has no WebGPU support.');
      }
      const bytes = await loadModelBytes();
      broadcast('starting');
      try {
        // 'basic' skips the aggressive graph fusions, which use much more
        // memory on a graph this large.
        return await ort.InferenceSession.create(bytes, { executionProviders: ['webgpu'], graphOptimizationLevel: 'basic' });
      } catch (err) {
        throw codeError('failed', `while loading the model: ${err?.message ?? err}`);
      }
    })().catch((err) => { sessionPromise = null; throw err; });
  }
  return sessionPromise.finally(() => listeners.delete(report));
}

function codeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

self.onmessage = async (event) => {
  // Warm-up: start downloading and preparing the model before any image.
  if (event.data.type === 'warm') {
    getSession(() => {}).catch(() => { /* errors show when an image is traced */ });
    return;
  }
  const { id, rgba, width, height } = event.data;
  const report = (phase, progress) => self.postMessage({ id, phase, progress });
  try {
    const s = await getSession(report);
    report('detecting');

    // Resize to 1024 x 1024 and normalize (ImageNet mean/std, CHW layout).
    const src = new OffscreenCanvas(width, height);
    src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer), width, height), 0, 0);
    const small = new OffscreenCanvas(SIZE, SIZE);
    const sctx = small.getContext('2d', { willReadFrequently: true });
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(src, 0, 0, SIZE, SIZE);
    const px = sctx.getImageData(0, 0, SIZE, SIZE).data;
    const plane = SIZE * SIZE;
    const input = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      // Transparent pixels count as white, like they look in a mockup.
      const a = px[i * 4 + 3] / 255;
      for (let c = 0; c < 3; c++) {
        const v = (px[i * 4 + c] * a + 255 * (1 - a)) / 255;
        input[c * plane + i] = (v - MEAN[c]) / STD[c];
      }
    }

    let out;
    try {
      out = await s.run({ input_image: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
    } catch (err) {
      throw codeError('failed', `while finding the design: ${err?.message ?? err}`);
    }
    const logits = out.output_image.data;

    // Sigmoid -> 8-bit mask, then scale back to the original size.
    const maskSmall = new ImageData(SIZE, SIZE);
    for (let i = 0; i < plane; i++) {
      const v = Math.round(255 / (1 + Math.exp(-logits[i])));
      const j = i * 4;
      maskSmall.data[j] = maskSmall.data[j + 1] = maskSmall.data[j + 2] = v;
      maskSmall.data[j + 3] = 255;
    }
    small.getContext('2d').putImageData(maskSmall, 0, 0);
    const full = new OffscreenCanvas(width, height);
    const fctx = full.getContext('2d', { willReadFrequently: true });
    fctx.imageSmoothingQuality = 'high';
    fctx.drawImage(small, 0, 0, width, height);
    const scaled = fctx.getImageData(0, 0, width, height).data;
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) mask[i] = scaled[i * 4];

    self.postMessage({ id, mask }, [mask.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message ?? err), code: err?.code ?? 'failed' });
  }
};

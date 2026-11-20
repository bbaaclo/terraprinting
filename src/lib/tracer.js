// Small promise wrapper around the trace worker.
let worker = null;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./trace.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error));
      else job.resolve({ svg: data.svg, palette: data.palette, background: data.background, colorCounts: data.colorCounts, silhouetteSvg: data.silhouetteSvg });
    };
    worker.onerror = (event) => {
      const err = new Error(event.message || 'The tracer stopped unexpectedly.');
      pending.forEach((job) => job.reject(err));
      pending.clear();
      worker.terminate();
      worker = null;
    };
  }
  return worker;
}

export function traceImage({ rgba, width, height }, settings) {
  const id = nextId++;
  // Copy so the decoded pixels stay usable for re-traces in step 2.
  const pixels = rgba.slice();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, rgba: pixels, width, height, settings }, [pixels.buffer]);
  });
}

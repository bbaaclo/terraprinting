// Runs the color reduction and VTracer off the main thread so the page stays
// responsive while tracing.
import { initVtracer, vectorize_rgba } from '../vendor/vtracer/vtracer.js';
import wasmUrl from '../vendor/vtracer/vtracer_bg.wasm?url';
import { quantize } from './quantize.js';
import { removeBackground } from './removeBackground.js';
import { majorityFilter } from './cleanup.js';

let ready = null;

function ensureReady() {
  if (!ready) {
    ready = fetch(wasmUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the tracer (${res.status}).`);
        return res.arrayBuffer();
      })
      .then((bytes) => initVtracer(bytes))
      .catch((err) => { ready = null; throw err; });
  }
  return ready;
}

self.onmessage = async (event) => {
  const { id, rgba, width, height, settings } = event.data;
  try {
    await ensureReady();
    const { pixels, palette } = quantize(rgba, settings.colors);
    // With the switch off this step is skipped, so the output is exactly
    // what it was before background removal existed.
    const background = settings.removeBackground
      ? removeBackground(pixels, width, height)
      : { status: 'off', removedShare: 0 };
    if (settings.cleanup) majorityFilter(pixels, width, height, settings.cleanup.radius, settings.cleanup.passes);
    const svg = vectorize_rgba(pixels, width, height, settings.vtracer);
    // Pixel count per color, used to sort shapes into layer groups.
    const colorCounts = {};
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 128) continue;
      const hex = '#' + [pixels[i], pixels[i + 1], pixels[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      colorCounts[hex] = (colorCounts[hex] || 0) + 1;
    }
    // Silhouette of the design in its main color, traced smooth, for the
    // clean Color layer (no folds or shading).
    const main = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    let silhouetteSvg = null;
    if (main) {
      const [r, g, b] = [1, 3, 5].map((k) => parseInt(main.slice(k, k + 2), 16));
      const sil = new Uint8Array(pixels.length);
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] >= 128) { sil[i] = r; sil[i + 1] = g; sil[i + 2] = b; sil[i + 3] = 255; }
      }
      majorityFilter(sil, width, height, 2, 1);
      silhouetteSvg = vectorize_rgba(sil, width, height, {
        ...settings.vtracer,
        filterSpeckle: Math.max(settings.vtracer.filterSpeckle, 12),
        cornerThreshold: 60, lengthThreshold: 6, spliceThreshold: 60,
      });
    }
    self.postMessage({ id, svg, palette, background, colorCounts, silhouetteSvg });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message ?? err) });
  }
};

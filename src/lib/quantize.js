// Reduces an image to at most `maxColors` flat colors before tracing.
//
// Why: VTracer's own maxColors option merges color areas by size, not by how
// similar they are. On a test jersey it merged the blue body into the orange
// stripes. So we pick the palette ourselves (k-means on a pixel sample), snap
// every pixel to its nearest palette color, and give VTracer an image that is
// already flat. Each palette color then becomes one fill in the SVG.
//
// Colors that cover almost nothing (usually blended edge pixels between two
// real colors) are dropped, so a 4-color design stays 4 colors.

const MIN_SHARE = 0.004;     // a color must cover at least 0.4% of the design
const SAMPLE_TARGET = 60000; // pixels sampled to find the palette
const ITERATIONS = 12;

export function quantize(rgba, maxColors) {
  const pixelCount = rgba.length / 4;
  const sample = samplePixels(rgba, pixelCount);
  if (sample.length === 0) return { pixels: rgba, palette: [] };

  let palette = kmeans(sample, Math.max(1, maxColors));
  palette = dropTinyColors(sample, palette);
  palette = addMissedAccent(sample, palette);

  const out = new Uint8Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue; // keep transparent areas transparent
    const c = palette[nearest(palette, rgba[i], rgba[i + 1], rgba[i + 2])];
    out[i] = c[0];
    out[i + 1] = c[1];
    out[i + 2] = c[2];
    out[i + 3] = 255;
  }
  return { pixels: out, palette };
}

function samplePixels(rgba, pixelCount) {
  const step = Math.max(1, Math.floor(pixelCount / SAMPLE_TARGET));
  const sample = [];
  for (let p = 0; p < pixelCount; p += step) {
    const i = p * 4;
    if (rgba[i + 3] >= 128) sample.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  }
  return sample;
}

function dist2(a, r, g, b) {
  const dr = a[0] - r;
  const dg = a[1] - g;
  const db = a[2] - b;
  return dr * dr + dg * dg + db * db;
}

function nearest(palette, r, g, b) {
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < palette.length; k++) {
    const d = dist2(palette[k], r, g, b);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

// k-means++ with a fixed seed, so the same image always gives the same result.
function kmeans(sample, k) {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  const centers = [sample[Math.floor(random() * sample.length)].slice()];
  const d = new Float64Array(sample.length);
  while (centers.length < k) {
    let total = 0;
    for (let i = 0; i < sample.length; i++) {
      const s = sample[i];
      d[i] = dist2(centers[nearest(centers, s[0], s[1], s[2])], s[0], s[1], s[2]);
      total += d[i];
    }
    if (total === 0) break; // fewer distinct colors than k
    let target = random() * total;
    let pick = 0;
    while (pick < sample.length - 1 && (target -= d[pick]) > 0) pick++;
    centers.push(sample[pick].slice());
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const s of sample) {
      const acc = sums[nearest(centers, s[0], s[1], s[2])];
      acc[0] += s[0]; acc[1] += s[1]; acc[2] += s[2]; acc[3]++;
    }
    let moved = false;
    sums.forEach((acc, k) => {
      if (!acc[3]) return;
      const next = [Math.round(acc[0] / acc[3]), Math.round(acc[1] / acc[3]), Math.round(acc[2] / acc[3])];
      if (next.some((v, j) => v !== centers[k][j])) moved = true;
      centers[k] = next;
    });
    if (!moved) break;
  }
  return centers;
}

// A tiny color is still kept when it is clearly different from every
// bigger color (a small red crest on a navy and white jersey), because
// logos are often small but matter.
const DISTINCT_DIST2 = 110 * 110;
const DISTINCT_MIN_SHARE = 0.0005;

function dropTinyColors(sample, palette) {
  const counts = new Array(palette.length).fill(0);
  for (const s of sample) counts[nearest(palette, s[0], s[1], s[2])]++;
  const big = palette.filter((_, k) => counts[k] / sample.length >= MIN_SHARE);
  const kept = palette.filter((c, k) => {
    const share = counts[k] / sample.length;
    if (share >= MIN_SHARE) return true;
    if (share < DISTINCT_MIN_SHARE) return false;
    return big.every((b) => dist2(b, c[0], c[1], c[2]) > DISTINCT_DIST2);
  });
  return kept.length ? kept : palette;
}

// k-means can miss a small, strongly different color (a red crest on a
// navy and white jersey). If enough pixels are far from every palette
// color, their average becomes one extra color.
function addMissedAccent(sample, palette) {
  const far = sample.filter((s) => palette.every((c) => dist2(c, s[0], s[1], s[2]) > DISTINCT_DIST2));
  if (far.length / sample.length < DISTINCT_MIN_SHARE) return palette;
  const mean = [0, 1, 2].map((j) => Math.round(far.reduce((a, s) => a + s[j], 0) / far.length));
  return [...palette, mean];
}

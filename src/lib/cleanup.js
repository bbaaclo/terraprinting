// Majority ("mode") filter on the palette-reduced pixels. Each pixel takes
// the most common color in its neighborhood. This removes thin slivers,
// fabric-fold streaks and noise, so the trace has far fewer tiny shapes,
// while large areas (names, numbers, logos, stripes) keep their shape.
// Transparent pixels count as their own "color", so cut-out edges stay put.

export function majorityFilter(pixels, width, height, radius, passes) {
  if (radius <= 0 || passes <= 0) return;
  const total = width * height;
  let key = new Int32Array(total);
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    key[p] = pixels[i + 3] < 128 ? -1 : (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
  }
  const winKeys = new Int32Array((2 * radius + 1) ** 2);
  const winCounts = new Int32Array(winKeys.length);
  for (let pass = 0; pass < passes; pass++) {
    const next = new Int32Array(total);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let n = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          for (let dx = -radius; dx <= radius; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= width) continue;
            const k = key[yy * width + xx];
            let j = 0;
            while (j < n && winKeys[j] !== k) j++;
            if (j === n) { winKeys[n] = k; winCounts[n] = 0; n++; }
            winCounts[j]++;
          }
        }
        const self = key[y * width + x];
        let best = self;
        let bestCount = 0;
        for (let j = 0; j < n; j++) if (winKeys[j] === self) bestCount = winCounts[j];
        for (let j = 0; j < n; j++) {
          if (winCounts[j] > bestCount) { bestCount = winCounts[j]; best = winKeys[j]; }
        }
        next[y * width + x] = best;
      }
    }
    key = next;
  }
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    const k = key[p];
    if (k === -1) { pixels[i] = pixels[i + 1] = pixels[i + 2] = pixels[i + 3] = 0; }
    else { pixels[i] = (k >> 16) & 255; pixels[i + 1] = (k >> 8) & 255; pixels[i + 2] = k & 255; pixels[i + 3] = 255; }
  }
}

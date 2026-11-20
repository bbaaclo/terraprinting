// Removes the plain background around a flat design, so only the object
// (jersey, uniform, logo) is traced.
//
// Runs on the palette-reduced pixels from quantize.js, where every pixel is
// exactly one palette color. How it works:
// 1. The most common color along the image border is the background
//    candidate. It must cover at least 60% of the border.
// 2. A flood fill from the border moves through that one color only. Areas
//    of the same color that the fill cannot reach (the inside of an "O", a
//    gap enclosed by the design) are kept.
// 3. Small leftover specks that sit mostly against the removed background
//    (noise along JPG edges) are removed too.
// 4. Safety checks: if the result looks wrong, nothing is removed and a
//    reason is returned instead.
//
// Removed pixels become fully transparent, so VTracer creates no shapes for
// them. The pixels array is changed in place only when removal succeeds.

const MIN_BORDER_SHARE = 0.6; // background color must cover 60% of the border
const MAX_REMOVED_SHARE = 0.85;
const MIN_REMOVED_SHARE = 0.02;
const SPECK_SHARE = 0.00005;  // specks up to 0.005% of the image...
const SPECK_MIN_PIXELS = 24;  // ...or 24 px, whichever is larger

export function removeBackground(pixels, width, height) {
  const total = width * height;
  const key = colorKeys(pixels, total);
  const border = borderIndexes(width, height);

  // Count colors on the border (-1 means transparent).
  const counts = new Map();
  for (const p of border) counts.set(key[p], (counts.get(key[p]) || 0) + 1);
  const [topKey, topCount] = [...counts].sort((a, b) => b[1] - a[1])[0];

  if (topKey === -1) {
    return { status: 'transparent', removedShare: 0 };
  }
  if (topCount / border.length < MIN_BORDER_SHARE) {
    return {
      status: 'kept',
      removedShare: 0,
      reason: 'The edges of the image have no single background color.',
    };
  }

  // Flood fill the background color from the border.
  const removed = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  for (const p of border) {
    if (key[p] === topKey && !removed[p]) {
      removed[p] = 1;
      queue[tail++] = p;
    }
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    if (x > 0) tail = visit(p - 1, topKey, key, removed, queue, tail);
    if (x < width - 1) tail = visit(p + 1, topKey, key, removed, queue, tail);
    if (p >= width) tail = visit(p - width, topKey, key, removed, queue, tail);
    if (p < total - width) tail = visit(p + width, topKey, key, removed, queue, tail);
  }
  let removedCount = tail;
  removedCount += removeEdgeSpecks(key, removed, width, height);

  const removedShare = removedCount / total;
  if (removedShare > MAX_REMOVED_SHARE) {
    return {
      status: 'kept',
      removedShare: 0,
      reason: 'Most of the image matches the background color, so the design may share it. The background was kept.',
    };
  }
  if (removedShare < MIN_REMOVED_SHARE) {
    return {
      status: 'kept',
      removedShare: 0,
      reason: 'Almost no background was found around the design.',
    };
  }

  for (let p = 0; p < total; p++) {
    if (removed[p]) {
      const i = p * 4;
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = 0;
    }
  }
  return { status: 'removed', removedShare };
}

function colorKeys(pixels, total) {
  const key = new Int32Array(total);
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    key[p] = pixels[i + 3] < 128 ? -1 : (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
  }
  return key;
}

function borderIndexes(width, height) {
  const out = [];
  for (let x = 0; x < width; x++) {
    out.push(x);
    if (height > 1) out.push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    out.push(y * width);
    if (width > 1) out.push(y * width + width - 1);
  }
  return out;
}

function visit(n, bgKey, key, removed, queue, tail) {
  if (!removed[n] && key[n] === bgKey) {
    removed[n] = 1;
    queue[tail++] = n;
  }
  return tail;
}

// Finds small same-color patches that mostly touch removed background
// (stray edge noise) and removes them. A small detail inside the design
// touches the design's own colors, not the background, so it is kept.
function removeEdgeSpecks(key, removed, width, height) {
  const total = width * height;
  const maxSize = Math.max(SPECK_MIN_PIXELS, Math.round(total * SPECK_SHARE));
  const seen = new Uint8Array(total);
  const stack = new Int32Array(total);
  const patch = new Int32Array(maxSize + 1);
  let removedExtra = 0;

  for (let start = 0; start < total; start++) {
    if (seen[start] || removed[start] || key[start] === -1) continue;
    const k = key[start];
    let top = 0;
    let size = 0;
    let bgNeighbors = 0;
    let otherNeighbors = 0;
    stack[top++] = start;
    seen[start] = 1;

    while (top > 0) {
      const p = stack[--top];
      if (size <= maxSize) patch[size] = p;
      size++;
      const x = p % width;
      const neighbors = [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        p >= width ? p - width : -1,
        p < total - width ? p + width : -1,
      ];
      for (const n of neighbors) {
        if (n < 0) continue;
        if (removed[n]) bgNeighbors++;
        else if (key[n] !== k) otherNeighbors++;
        else if (!seen[n]) {
          seen[n] = 1;
          stack[top++] = n;
        }
      }
    }

    if (size <= maxSize && bgNeighbors > 0 && bgNeighbors >= otherNeighbors) {
      for (let j = 0; j < size; j++) removed[patch[j]] = 1;
      removedExtra += size;
    }
  }
  return removedExtra;
}

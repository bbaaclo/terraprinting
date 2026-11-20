// Small images are enlarged 2x (smooth resampling) before tracing, so thin
// lines and small lettering have enough pixels to keep their shape. The SVG
// keeps the original width and height; only its viewBox uses the larger
// coordinates, so it opens at the original size.
const SMALL_SIDE = 1500;

export function upscaleIfSmall({ rgba, width, height }) {
  if (Math.max(width, height) >= SMALL_SIDE) return { rgba, width, height, scale: 1 };
  const scale = 2;
  const src = document.createElement('canvas');
  src.width = width;
  src.height = height;
  src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer.slice(0)), width, height), 0, 0);
  const dst = document.createElement('canvas');
  dst.width = width * scale;
  dst.height = height * scale;
  const ctx = dst.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, dst.width, dst.height);
  const out = ctx.getImageData(0, 0, dst.width, dst.height).data;
  return { rgba: new Uint8Array(out.buffer), width: dst.width, height: dst.height, scale };
}

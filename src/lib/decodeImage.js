// Reads a PNG, JPG or WebP file into raw RGBA pixels in the browser.
// The browser does the decoding, so WebP works even though the tracer's own
// decoder only knows PNG and JPEG.

export const ACCEPTED_TYPES = {
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/webp': 'WebP',
};

const EXTENSION_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

export function detectType(file) {
  if (ACCEPTED_TYPES[file.type]) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[ext] ?? null;
}

export async function decodeImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This image could not be opened. Save it again as PNG and try once more.');
  }
  const { width, height } = bitmap;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, width, height);
  return { rgba: new Uint8Array(data.buffer), width, height };
}

// Front and back sent as two images: both are scaled to the same height and
// placed side by side with a transparent gap, so the rest of the app sees
// one image with two garments (the same as a customer mockup showing both).
// Returns the pixels plus a PNG preview of the joined image.
export async function decodeSideBySide(files) {
  const bitmaps = [];
  try {
    for (const file of files) bitmaps.push(await createImageBitmap(file));
  } catch {
    bitmaps.forEach((b) => b.close());
    throw new Error('One of the images could not be opened. Save it again as PNG and try once more.');
  }
  const height = Math.max(...bitmaps.map((b) => b.height));
  const widths = bitmaps.map((b) => Math.round((b.width * height) / b.height));
  const gap = Math.round(height * 0.06);
  const width = widths.reduce((a, w) => a + w, 0) + gap * (bitmaps.length - 1);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let x = 0;
  bitmaps.forEach((b, i) => {
    ctx.drawImage(b, x, 0, widths[i], height);
    x += widths[i] + gap;
    b.close();
  });
  const { data } = ctx.getImageData(0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { pixels: { rgba: new Uint8Array(data.buffer), width, height }, blob };
}

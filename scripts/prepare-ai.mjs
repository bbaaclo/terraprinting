// Prepares the "Smart (AI)" background removal. Runs after `npm install` and
// before `npm run dev` / `npm run build`. It does two things:
// 1. Copies the ONNX Runtime WebGPU file into public/ort/.
// 2. Downloads the browser build of BiRefNet-lite (MIT, about 104 MB) once,
//    pinned to a fixed version, and checks its SHA-256. This build computes
//    the model's deformable convolutions in small chunks, so it fits in
//    browser memory (the stock export crashed with "memory access out of
//    bounds"), and it stays within Chrome's WebGPU limits on a Mac.
//    Source: huggingface.co/clevr-tools/birefnet-lite-web
// If the download fails (no internet), the app still runs: smart removal
// falls back to plain-color removal and says so.
import { createHash } from 'node:crypto';
import { copyFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const MODEL_URL = 'https://huggingface.co/clevr-tools/birefnet-lite-web/resolve/f01535dcce4c28a8688ee631ca15719b779b3f86/birefnet_lite_768_fp16w.onnx';
const MODEL_SHA256 = '120ac2a3a0830a7156b5a3074d07000e0220def3b9ca68d55626b6c90a5e9b61';
const MODEL_SIZE = 104329641;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// 1. ONNX Runtime file
const ortDist = dirname(require.resolve('onnxruntime-web/webgpu'));
const ortOut = join(root, 'public', 'ort');
mkdirSync(ortOut, { recursive: true });
copyFileSync(join(ortDist, 'ort-wasm-simd-threaded.asyncify.wasm'), join(ortOut, 'ort-wasm-simd-threaded.asyncify.wasm'));

// 1b. Text recognition (tesseract.js, Apache-2.0) for the Name / Number /
// Text layers: worker, engine and English data, all served locally.
const ocrOut = join(root, 'public', 'ocr');
mkdirSync(join(ocrOut, 'core'), { recursive: true });
mkdirSync(join(ocrOut, 'lang'), { recursive: true });
copyFileSync(join(dirname(require.resolve('tesseract.js')), '..', 'dist', 'worker.min.js'), join(ocrOut, 'worker.min.js'));
const coreDir = dirname(require.resolve('tesseract.js-core/package.json'));
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
  copyFileSync(join(coreDir, f), join(ocrOut, 'core', f));
}
const langDir = dirname(require.resolve('@tesseract.js-data/eng/package.json'));
copyFileSync(join(langDir, '4.0.0_best_int', 'eng.traineddata.gz'), join(ocrOut, 'lang', 'eng.traineddata.gz'));

// 2. Model
const modelDir = join(root, 'public', 'models');
const modelPath = join(modelDir, 'birefnet-lite-768.onnx');
mkdirSync(modelDir, { recursive: true });
rmSync(join(modelDir, 'birefnet-lite.onnx'), { force: true }); // older 1024 model, no longer used

if (existsSync(modelPath) && statSync(modelPath).size === MODEL_SIZE) {
  console.log('prepare-ai: AI model ready.');
} else {
  try {
    await download();
    console.log('prepare-ai: AI model downloaded and verified.');
  } catch (err) {
    console.warn(`prepare-ai: could not download the AI model (${err.message}).`);
    console.warn('prepare-ai: the app still works; smart background removal will use plain-color removal until the model is downloaded.');
  }
}

async function download() {
  console.log('prepare-ai: downloading the AI model (about 104 MB, one time only)...');
  const res = await fetch(MODEL_URL);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const tmp = `${modelPath}.part`;
  let received = 0;
  let lastShown = -1;
  const progress = new TransformStream({
    transform(chunk, controller) {
      received += chunk.length;
      const pct = Math.floor((received / MODEL_SIZE) * 10) * 10;
      if (pct !== lastShown) {
        lastShown = pct;
        process.stdout.write(`prepare-ai: ${pct}%\n`);
      }
      controller.enqueue(chunk);
    },
  });
  await pipeline(Readable.fromWeb(res.body.pipeThrough(progress)), createWriteStream(tmp));
  const hash = createHash('sha256');
  await pipeline(createReadStream(tmp), hash);
  if (hash.digest('hex') !== MODEL_SHA256) {
    rmSync(tmp, { force: true });
    throw new Error('the downloaded file did not match the expected checksum');
  }
  renameSync(tmp, modelPath);
}

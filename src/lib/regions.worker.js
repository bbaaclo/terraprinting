// Smart recognition: finds where the text (team name, number) and the logo
// are on the design, with Microsoft's Florence-2 model (MIT license),
// running on the GPU (WebGPU) inside this worker. The image never leaves
// the computer; only the model is downloaded once from Hugging Face, pinned
// to one exact version, and kept in the browser's cache after that.
//
// Two questions are asked of the model:
//   <OCR_WITH_REGION>              every line of text and where it is
//   <CAPTION_TO_PHRASE_GROUNDING>  where "a team logo" is
// The answers are boxes in the image's own pixel coordinates; layers.js
// then puts the traced shapes inside each box into the right layer.
import { AutoProcessor, Florence2ForConditionalGeneration, RawImage, env } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/Florence-2-base-ft';
const REVISION = 'e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f'; // pinned: the files can never change under us
// 4-bit weights, about 231 MB in all. Needs a GPU that supports 16-bit
// shaders (almost every desktop GPU in Chrome does).
// The text decoder is loaded as plain 4-bit (q4), not q4f16: the 16-bit
// conversion of that one file leaves an output wired straight through its
// branches, which current ONNX Runtime rejects as an invalid model ("Subgraph
// output (logits) is an outer scope value"). The other three files have no
// branches, so their smaller 16-bit versions load fine.
const DTYPE = { embed_tokens: 'q4f16', vision_encoder: 'q4f16', encoder_model: 'q4f16', decoder_model_merged: 'q4' };
// If a decoder still will not load, try once more with the 8-bit decoder
// (98 MB instead of 64 MB; the other files are already in the cache).
const DTYPE_RETRY = { ...DTYPE, decoder_model_merged: 'quantized' };
const LOGO_PHRASE = 'a team logo';

env.allowLocalModels = false;
// The model runtime's own files are served by this app (scripts/prepare-ai.mjs),
// not fetched from a public CDN.
env.backends.onnx.wasm.wasmPaths = {
  mjs: '/ort-tjs/ort-wasm-simd-threaded.asyncify.mjs',
  wasm: '/ort-tjs/ort-wasm-simd-threaded.asyncify.wasm',
};

let loading = null;

function codeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function load(report) {
  if (!self.navigator?.gpu) throw codeError('no-webgpu', 'This browser has no WebGPU support.');
  const adapter = await self.navigator.gpu.requestAdapter();
  if (!adapter) throw codeError('no-webgpu', 'No graphics card is available to WebGPU.');
  if (!adapter.features.has('shader-f16')) throw codeError('no-f16', 'This graphics card cannot run the 16-bit model.');
  report('loading-regions');
  let processor;
  try {
    processor = await AutoProcessor.from_pretrained(MODEL_ID, { revision: REVISION });
  } catch (err) {
    throw codeError('no-model', `The recognition model could not be downloaded (${err?.message ?? err}).`);
  }
  let lastError = null;
  for (const dtype of [DTYPE, DTYPE_RETRY]) {
    try {
      const model = await Florence2ForConditionalGeneration.from_pretrained(MODEL_ID, { revision: REVISION, dtype, device: 'webgpu' });
      return { model, processor };
    } catch (err) {
      lastError = err;
      console.warn(`Smart recognition: the ${dtype.decoder_model_merged} decoder did not load:`, err?.message ?? err);
    }
  }
  const message = String(lastError?.message ?? lastError);
  // A download problem and a model that downloaded but will not start in
  // this browser need different advice, so they get different codes.
  const code = /fetch|network|404|Could not locate|Failed to load/i.test(message) && !/session|invalid model/i.test(message) ? 'no-model' : 'bad-model';
  throw codeError(code, `The recognition model could not be started (${message}).`);
}

async function ask({ model, processor }, image, task, input = '') {
  const inputs = await processor(image, task + input);
  const ids = await model.generate({ ...inputs, max_new_tokens: 256 });
  const text = processor.batch_decode(ids, { skip_special_tokens: false })[0];
  return processor.post_process_generation(text, task, image.size)[task];
}

const boxOf = (coords) => {
  const xs = coords.filter((_, i) => i % 2 === 0);
  const ys = coords.filter((_, i) => i % 2 === 1);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

self.onmessage = async ({ data }) => {
  const { id, rgba, width, height } = data;
  const report = (phase) => self.postMessage({ id, phase });
  try {
    if (!loading) loading = load(report).catch((err) => { loading = null; throw err; });
    const ai = await loading;
    report('regions');
    const image = new RawImage(new Uint8ClampedArray(rgba), width, height, 4);
    const ocr = await ask(ai, image, '<OCR_WITH_REGION>');
    const logo = await ask(ai, image, '<CAPTION_TO_PHRASE_GROUNDING>', LOGO_PHRASE);
    const words = (ocr?.quad_boxes ?? []).map((q, i) => ({ text: ocr.labels[i] ?? '', bbox: boxOf(q) }));
    const logos = (logo?.bboxes ?? []).map((b) => ({ bbox: boxOf(b) }));
    self.postMessage({ id, result: { words, logos } });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message ?? err), code: err?.code ?? 'failed' });
  }
};

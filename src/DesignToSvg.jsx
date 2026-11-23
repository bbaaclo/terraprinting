import { useCallback, useEffect, useRef, useState } from 'react';
import UploadScreen from './components/UploadScreen.jsx';
import ResultScreen from './components/ResultScreen.jsx';
import { ACCEPTED_TYPES, decodeImage, detectType } from './lib/decodeImage.js';
import { traceImage } from './lib/tracer.js';
import { finalizeSvg } from './lib/svgOutput.js';
import { DEFAULT_ADJUST, DEFAULT_TRACE_SETTINGS, buildTraceSettings } from './lib/traceSettings.js';
import { applyMask, getAiMask } from './lib/aiBackground.js';
import { upscaleIfSmall } from './lib/upscale.js';
import { setLastDesign } from './lib/lastDesign.js';
import { svgFileName } from './lib/svgOutput.js';
import { findWords } from './lib/ocr.js';
import { buildLayeredSvg, classify, readPaths } from './lib/layers.js';

const AI_FALLBACK_NOTES = {
  'no-webgpu': 'Smart removal needs WebGPU, which this browser does not offer. Plain-color removal was used instead.',
  'no-model': 'The AI model is not downloaded yet. Run npm install with internet on, then restart the app. Plain-color removal was used instead.',
  unclear: 'The AI could not find a clear design in this image. Plain-color removal was used instead.',
};

const EMPTY_TRACE = { status: 'idle', phase: null, svg: null, error: null, background: null, note: null, layers: null };

// Words found per image and background setting, so switching the
// background options does not run text recognition again.
const wordCache = new WeakMap();

export default function DesignToSvg() {
  const [image, setImage] = useState(null); // { name, format, url, width, height, pixels }
  const [trace, setTrace] = useState(EMPTY_TRACE);
  const [removeBg, setRemoveBg] = useState(DEFAULT_TRACE_SETTINGS.removeBackground);
  const [bgMethod, setBgMethod] = useState(DEFAULT_TRACE_SETTINGS.backgroundMethod);
  // Trace settings are fixed (the sliders were removed); see traceSettings.js.
  const adjust = DEFAULT_ADJUST;
  const [uploadError, setUploadError] = useState(null);
  const [opening, setOpening] = useState(false);
  const traceRun = useRef(0);

  const runTrace = useCallback(async (img, remove, method, adj) => {
    const run = ++traceRun.current;
    const current = () => run === traceRun.current; // a newer upload or setting replaces this run
    const useAi = remove && method === 'ai';
    setTrace({ ...EMPTY_TRACE, status: 'tracing', phase: useAi ? 'detecting' : 'tracing' });
    try {
      let pixels = img.pixels;
      let background = null;
      let note = null;
      let settings = buildTraceSettings(adj, remove);

      if (useAi) {
        try {
          const mask = await getAiMask(img.pixels, (phase) => {
            if (current()) setTrace((t) => ({ ...t, phase }));
          });
          const result = applyMask(img.pixels, mask);
          if (result.usable) {
            pixels = result.pixels;
            background = { status: 'removed-ai', removedShare: result.removedShare };
            settings.removeBackground = false; // already done by the AI
          } else {
            note = AI_FALLBACK_NOTES.unclear;
          }
        } catch (err) {
          note = AI_FALLBACK_NOTES[err.code] ?? `Smart removal did not finish (${err.message}). Plain-color removal was used instead.`;
        }
        if (!current()) return;
        setTrace((t) => ({ ...t, phase: 'tracing' }));
      }

      const work = upscaleIfSmall(pixels);
      settings = { ...buildTraceSettings(adj, settings.removeBackground, work.scale) };
      const { svg, palette, background: traced, colorCounts, silhouetteSvg } = await traceImage(work, settings);
      if (!current()) return;
      const flat = finalizeSvg(svg, img.width, img.height, palette, work.width, work.height);

      // Layer groups: read the shapes, find words, sort into groups.
      setTrace((t) => ({ ...t, phase: 'layers' }));
      let words = [];
      const wordKey = `${remove}-${method}-${work.width}`;
      const perImage = wordCache.get(img) ?? new Map();
      wordCache.set(img, perImage);
      try {
        if (!perImage.has(wordKey)) perImage.set(wordKey, findWords(work));
        words = await perImage.get(wordKey);
      } catch (err) {
        perImage.delete(wordKey);
        note = [note, 'Text recognition did not run, so names and numbers stay in the Pattern layer.'].filter(Boolean).join(' ');
        console.error('Text recognition failed:', err);
      }
      if (!current()) return;
      const silhouette = silhouetteSvg
        ? readPaths(finalizeSvg(silhouetteSvg, img.width, img.height, palette, work.width, work.height))
        : null;
      const { data, assign } = classify(readPaths(flat), silhouette, words, colorCounts);
      setTrace({
        ...EMPTY_TRACE,
        status: 'done',
        svg: buildLayeredSvg(data, assign, img.width, img.height),
        layers: { data, assign },
        background: background ?? traced,
        note,
      });
    } catch (err) {
      if (!current()) return;
      setTrace({ ...EMPTY_TRACE, status: 'error', error: `The trace did not finish: ${err.message}` });
    }
  }, []);

  const toggleRemoveBg = () => {
    const next = !removeBg;
    setRemoveBg(next);
    if (image) runTrace(image, next, bgMethod, adjust);
  };

  const changeBgMethod = (method) => {
    if (method === bgMethod) return;
    setBgMethod(method);
    if (image && removeBg) runTrace(image, removeBg, method, adjust);
  };

  // Moves one shape to another layer group (from the Layers panel).
  const moveShape = (index, group) => {
    setTrace((t) => {
      if (!t.layers) return t;
      const assign = [...t.layers.assign];
      assign[index] = group;
      return { ...t, layers: { ...t.layers, assign }, svg: buildLayeredSvg(t.layers.data, assign, image.width, image.height) };
    });
  };

  const handleFile = useCallback(async (file) => {
    const type = detectType(file);
    if (!type) {
      setUploadError(`“${file.name}” is not a PNG, JPG or WebP image. Choose one of those formats.`);
      setImage(null);
      return;
    }
    setUploadError(null);
    setOpening(true);
    try {
      const pixels = await decodeImage(file);
      const next = {
        name: file.name,
        format: ACCEPTED_TYPES[type],
        url: URL.createObjectURL(file),
        width: pixels.width,
        height: pixels.height,
        pixels,
      };
      setImage(next);
      runTrace(next, removeBg, bgMethod, adjust);
    } catch (err) {
      setImage(null);
      setUploadError(err.message);
    } finally {
      setOpening(false);
    }
  }, [runTrace, removeBg, bgMethod, adjust]);

  // Remember the latest layered SVG so the Size chart can use it as a pattern.
  useEffect(() => { if (trace.svg && image) setLastDesign({ name: svgFileName(image.name), svg: trace.svg }); }, [trace.svg, image]);

  // Free the previous preview image when a new one replaces it.
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  if (!image) {
    return <UploadScreen onFile={handleFile} error={uploadError} busy={opening} />;
  }
  return (
    <ResultScreen
      image={image}
      trace={trace}
      removeBg={removeBg}
      bgMethod={bgMethod}
      onMoveShape={moveShape}
      onToggleRemoveBg={toggleRemoveBg}
      onChangeBgMethod={changeBgMethod}
      onFile={handleFile}
      onRetry={() => runTrace(image, removeBg, bgMethod, adjust)}
    />
  );
}

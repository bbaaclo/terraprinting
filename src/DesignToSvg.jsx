import { useCallback, useEffect, useRef, useState } from 'react';
import UploadScreen from './components/UploadScreen.jsx';
import ResultScreen from './components/ResultScreen.jsx';
import { ACCEPTED_TYPES, decodeImage, decodeSideBySide, detectType } from './lib/decodeImage.js';
import { traceImage } from './lib/tracer.js';
import { finalizeSvg } from './lib/svgOutput.js';
import { DEFAULT_ADJUST, DEFAULT_TRACE_SETTINGS, buildTraceSettings } from './lib/traceSettings.js';
import { applyMask, getAiMask } from './lib/aiBackground.js';
import { upscaleIfSmall } from './lib/upscale.js';
import { setLastDesign } from './lib/lastDesign.js';
import { svgFileName } from './lib/svgOutput.js';
import { findWords } from './lib/ocr.js';
import { getAiRegions, mergeRegions } from './lib/aiRegions.js';
import { buildLayeredSvg, classify, readPaths } from './lib/layers.js';
import { applyTemplate, createModel, layersFromParts, moveShapeToLayer, paletteFrom, placePieces, setGarmentSide, toLayers } from './lib/pieces.js';
import { findTemplate } from './lib/garmentTemplates.js';
import { getData } from './lib/store.js';

// Garment type used to cut the design into pieces (picked on the By piece view).
const DEFAULT_GARMENT = 'jersey';

const templates = () => getData().garmentTemplates;

const AI_FALLBACK_NOTES = {
  'no-webgpu': 'Smart removal needs WebGPU, which this browser does not offer. Plain-color removal was used instead.',
  'no-model': 'The AI model is not downloaded yet. Run npm install with internet on, then restart the app. Plain-color removal was used instead.',
  unclear: 'The AI could not find a clear design in this image. Plain-color removal was used instead.',
};

// model: the shared design model (lib/pieces.js). layers is derived from it
// for the screens that still read { data, assign }.
// When smart recognition cannot run, the basic text reader still finds
// plain names and numbers; logos and stylized lettering may stay in Main
// Pattern, where staff can move them.
const REGION_FALLBACK_NOTES = {
  'no-webgpu': 'Smart recognition needs WebGPU (Chrome on a computer). Names and numbers were found with the basic reader; logos may be in Main Pattern.',
  'no-f16': 'This graphics card cannot run smart recognition. Names and numbers were found with the basic reader; logos may be in Main Pattern.',
  'no-model': 'The recognition model could not be downloaded (it needs internet the first time, about 231 MB). The basic reader was used instead.',
  'bad-model': 'The recognition model downloaded but could not start in this browser. The basic reader was used instead. The browser console (F12) has the details.',
};

const EMPTY_TRACE = { status: 'idle', phase: null, svg: null, error: null, background: null, note: null, model: null, layers: null };

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
  const [garment, setGarment] = useState(DEFAULT_GARMENT);
  const garmentRef = useRef(garment);
  garmentRef.current = garment;
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

      // Smart recognition: where the team name, number and logo are.
      let logoBoxes = [];
      const aiKey = `ai-${wordKey}`;
      try {
        if (!perImage.has(aiKey)) {
          perImage.set(aiKey, getAiRegions(work, (phase) => { if (current()) setTrace((t) => ({ ...t, phase })); }));
        }
        const merged = mergeRegions(words, await perImage.get(aiKey));
        words = merged.words;
        logoBoxes = merged.logos;
      } catch (err) {
        perImage.delete(aiKey);
        note = [note, REGION_FALLBACK_NOTES[err.code] ?? `Smart recognition did not finish (${err.message}). The basic reader was used instead.`].filter(Boolean).join(' ');
      }
      if (!current()) return;
      const silhouette = silhouetteSvg
        ? readPaths(finalizeSvg(silhouetteSvg, img.width, img.height, palette, work.width, work.height))
        : null;
      const { data, assign, garments } = classify(readPaths(flat), silhouette, words, colorCounts, logoBoxes);
      const placed = placePieces(createModel(data, assign, img.width, img.height), garments);
      const model = layersFromParts(applyTemplate(
        { ...placed, palette: paletteFrom(colorCounts) },
        findTemplate(templates(), garmentRef.current),
      ));
      const layers = toLayers(model);
      setTrace({
        ...EMPTY_TRACE,
        status: 'done',
        svg: buildLayeredSvg(layers.data, layers.assign, img.width, img.height),
        model,
        layers,
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

  // Every change to the model goes through here, so layers and the
  // download always match it.
  const changeModel = (edit) => {
    setTrace((t) => {
      if (!t.model) return t;
      const model = edit(t.model);
      if (model === t.model) return t;
      const layers = toLayers(model);
      return { ...t, model, layers, svg: buildLayeredSvg(layers.data, layers.assign, image.width, image.height) };
    });
  };

  // Moves one shape to another layer group (from the Layers panel or a tile).
  const moveShape = (index, group) => changeModel((m) => moveShapeToLayer(m, index, group));

  // Re-cuts the garments with another template (jersey, T-shirt, singlet).
  const changeGarment = (key) => {
    setGarment(key);
    changeModel((m) => layersFromParts(applyTemplate(m, findTemplate(templates(), key))));
  };

  // Staff correcting front and back: every garment switches side.
  const swapSides = () => changeModel((m) => m.garments.reduce(
    (acc, g, i) => setGarmentSide(acc, i, g.side === 'back' ? 'front' : 'back'), m,
  ));

  // One image, or two (front and back) that are joined side by side.
  const handleFile = useCallback(async (input) => {
    const files = (Array.isArray(input) ? input : [input]).slice(0, 2);
    const bad = files.find((f) => !detectType(f));
    if (bad) {
      setUploadError(`“${bad.name}” is not a PNG, JPG or WebP image. Choose one of those formats.`);
      setImage(null);
      return;
    }
    setUploadError(null);
    setOpening(true);
    try {
      let next;
      if (files.length === 2) {
        const { pixels, blob } = await decodeSideBySide(files);
        const base = files[0].name.replace(/\.[^.]+$/, '');
        next = {
          name: `${base}-front-back.png`,
          format: `${ACCEPTED_TYPES[detectType(files[0])]} + ${ACCEPTED_TYPES[detectType(files[1])]}`,
          url: URL.createObjectURL(blob),
          width: pixels.width,
          height: pixels.height,
          pixels,
        };
      } else {
        const file = files[0];
        const pixels = await decodeImage(file);
        next = {
          name: file.name,
          format: ACCEPTED_TYPES[detectType(file)],
          url: URL.createObjectURL(file),
          width: pixels.width,
          height: pixels.height,
          pixels,
        };
      }
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
      garment={garment}
      templates={templates()}
      onChangeGarment={changeGarment}
      onSwapSides={swapSides}
      onToggleRemoveBg={toggleRemoveBg}
      onChangeBgMethod={changeBgMethod}
      onFile={handleFile}
      onRetry={() => runTrace(image, removeBg, bgMethod, adjust)}
    />
  );
}

import { useMemo, useRef, useState } from 'react';
import LayersPanel from './LayersPanel.jsx';
import { buildLayeredSvg } from '../lib/layers.js';
import AppHeader from './AppHeader.jsx';
import { DownloadIcon, ImageIcon } from './icons.jsx';
import { inlineSvg, svgFileName, svgStats } from '../lib/svgOutput.js';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PHASE_TEXT = {
  loading: 'Loading the AI model…',
  starting: 'Preparing the AI model on your graphics card…',
  layers: 'Finding names, numbers and logos…',
  detecting: 'Finding the design…',
  tracing: 'Tracing the design…',
};

const BACKGROUND_LABELS = {
  'removed-ai': 'Removed (AI)',
  removed: 'Removed (plain color)',
  transparent: 'Already transparent',
  kept: 'Kept',
  off: 'Included',
};

export default function ResultScreen({ image, trace, removeBg, bgMethod, onMoveShape, onToggleRemoveBg, onChangeBgMethod, onFile, onRetry }) {
  const inputRef = useRef(null);
  const stats = useMemo(() => (trace.svg ? svgStats(trace.svg) : null), [trace.svg]);
  const [hidden, setHidden] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const layers = trace.layers;
  const markup = useMemo(() => {
    if (!trace.svg) return null;
    if (!layers) return { __html: inlineSvg(trace.svg) };
    const svg = buildLayeredSvg(layers.data, layers.assign, image.width, image.height, { hidden, forPreview: true });
    const highlight = selected != null
      ? `<style>.svg-preview [data-i="${selected}"]{stroke:#EC8233;stroke-width:6px;vector-effect:non-scaling-stroke;paint-order:stroke}</style>`
      : '';
    return { __html: highlight + svg };
  }, [trace.svg, layers, hidden, selected, image.width, image.height]);

  const toggleGroup = (key) => setHidden((h) => {
    const next = new Set(h);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const pickShape = (e) => {
    const el = e.target.closest?.('[data-i]');
    setSelected(el ? Number(el.dataset.i) : null);
  };
  const fileSize = useMemo(() => (trace.svg ? new Blob([trace.svg]).size : 0), [trace.svg]);
  const outName = svgFileName(image.name);

  const download = () => {
    const blob = new Blob([trace.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = outName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  let resultPill = <span className="pill pill-working">Tracing…</span>;
  if (trace.status === 'error') resultPill = <span className="pill pill-error">Trace failed</span>;
  if (stats) resultPill = <span className="pill pill-success">Traced · {stats.colors} colors · {stats.shapes} shapes</span>;

  return (
    <>
      <AppHeader>
        <span className="file-chip" title={image.name}>
          <ImageIcon width={16} height={16} />
          <span className="file-chip-name">{image.name}</span>
        </span>
        <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
          Upload another
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onFile(file);
          }}
        />
      </AppHeader>

      <main className="studio">
        <div className="compare">
          <section className="panel view" aria-labelledby="original-label">
            <div className="panel-head">
              <h2 id="original-label">Original</h2>
              <span className="pill">{image.format} · {image.width} × {image.height}</span>
            </div>
            <div className="stage">
              <img src={image.url} alt="Uploaded design" />
            </div>
          </section>

          <section className="panel view panel-active" aria-labelledby="result-label" aria-busy={trace.status === 'tracing'}>
            <div className="panel-head">
              <h2 id="result-label">SVG result</h2>
              {resultPill}
            </div>
            <div className="stage">
              {trace.status === 'tracing' && <span className="progress" aria-hidden="true" />}
              {markup && <div className={`svg-preview${layers ? ' is-pickable' : ''}`} role="img" aria-label="Traced SVG" onClick={pickShape} dangerouslySetInnerHTML={markup} />}
              {trace.status === 'tracing' && (
                <div className="stage-message">
                  <p>
                    {trace.phase === 'loading' && trace.progress != null
                      ? `Downloading the AI model, one time only: ${trace.progress}% of 100 MB`
                      : PHASE_TEXT[trace.phase] ?? PHASE_TEXT.tracing}
                  </p>
                  {trace.phase === 'loading' && trace.progress != null && (
                    <span className="load-bar" aria-hidden="true"><span style={{ width: `${trace.progress}%` }} /></span>
                  )}
                  {['loading', 'starting', 'detecting'].includes(trace.phase) && bgMethod === 'ai' && (
                    <button type="button" className="link-btn" onClick={() => onChangeBgMethod('color')}>Use Plain color instead</button>
                  )}
                </div>
              )}
              {trace.status === 'error' && (
                <div className="stage-message" role="alert">
                  <p>{trace.error}</p>
                  <button type="button" className="btn btn-secondary" onClick={onRetry}>Trace again</button>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="inspector" aria-label="Layers and export">
          <div className="inspector-body">
            <LayersPanel
              layers={layers}
              hidden={hidden}
              onToggle={toggleGroup}
              selected={selected}
              onClearSelection={() => setSelected(null)}
              onMove={onMoveShape}
            />

            <section className="insp-section" aria-labelledby="bg-label">
              <div className="switch-row">
                <span id="bg-label" className="insp-title">Remove background</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={removeBg}
                  aria-labelledby="bg-label"
                  className="switch"
                  onClick={onToggleRemoveBg}
                  disabled={trace.status === 'tracing'}
                >
                  <span className="switch-thumb" />
                </button>
              </div>
              {removeBg && (
                <div className="segmented" role="radiogroup" aria-label="Background removal method">
                  {[
                    { value: 'ai', label: 'Smart (AI)' },
                    { value: 'color', label: 'Plain color' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={bgMethod === opt.value}
                      className="segment"
                      onClick={() => onChangeBgMethod(opt.value)}
                      disabled={trace.status === 'tracing'}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              {trace.note && <p className="notice" role="status">{trace.note}</p>}
              {trace.background?.status === 'kept' && (
                <p className="notice" role="status">{trace.background.reason}</p>
              )}
            </section>

            <section className="insp-section" aria-label="File details">
              <dl className="stat-grid">
                <div><dt>Background</dt><dd>{trace.background ? BACKGROUND_LABELS[trace.background.status] : '–'}</dd></div>
                <div><dt>Canvas</dt><dd>{image.width} × {image.height}</dd></div>
                <div><dt>Shapes</dt><dd>{stats ? stats.shapes : '–'}</dd></div>
                <div><dt>Colors</dt><dd>{stats ? stats.colors : '–'}</dd></div>
                <div><dt>Size</dt><dd>{stats ? formatBytes(fileSize) : '–'}</dd></div>
              </dl>
            </section>
          </div>

          <div className="inspector-footer">
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={download} disabled={!trace.svg}>
              <DownloadIcon width={18} height={18} />
              {layers ? 'Download layered SVG' : 'Download SVG'}
            </button>
            <p className="export-note truncate" title={outName}>{outName} · plain paths, opens sharp in Photoshop</p>
          </div>
        </aside>
      </main>
    </>
  );
}

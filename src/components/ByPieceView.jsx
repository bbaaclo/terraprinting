// "Upload a photo, get every piece": the uploaded design on the left, and
// every layer of every garment side on the right as its own tile.
// Matches the approved mockup (piece-layers-mockup.png).
import { useMemo, useState } from 'react';
import { GROUPS } from '../lib/layers.js';
import { buildTiles } from '../lib/pieceTiles.js';
import { findTemplate } from '../lib/garmentTemplates.js';
import { DownloadIcon } from './icons.jsx';

const SIDE_LABEL = { front: 'Front', back: 'Back' };

export default function ByPieceView({ image, trace, garment, templates, onChangeGarment, onSwapSides, onMoveShape, onDownload }) {
  const model = trace.model;
  const [selected, setSelected] = useState(null);
  const tiles = useMemo(() => (model?.garments.length ? buildTiles(model) : []), [model]);
  const template = findTemplate(templates, garment);
  const garments = model?.garments ?? [];
  const partNames = ['front', 'back', ...(template?.parts ?? []).map((p) => p.label.toLowerCase())];
  const busy = trace.status === 'tracing';
  const shape = selected != null ? model?.shapes[selected] : null;

  const pick = (e) => {
    const el = e.target.closest?.('[data-i]');
    setSelected(el ? Number(el.dataset.i) : null);
  };

  return (
    <main className="pieces-page">
      <div className="pieces-title">
        <h1>Upload a photo, get every piece</h1>
        <span className="accent-bar" aria-hidden="true"><span /><span /></span>
      </div>

      <div className="pieces-board">
        <section className="pieces-card" aria-labelledby="source-label">
          <h2 id="source-label">Uploaded design</h2>
          <p className="pieces-sub">Customer's flat {template?.label.toLowerCase() ?? 'garment'} design, front and back</p>
          <div className="source-stage">
            <img src={image.url} alt="Uploaded design" />
          </div>
          {garments.length > 0 && (
            <div className="source-sides">
              <span className="source-side-list">
                {garments.map((g, i) => <span key={i} className="side-tag">{SIDE_LABEL[g.side]}</span>)}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onSwapSides} disabled={busy}>
                Swap front and back
              </button>
            </div>
          )}

          <h3 className="pieces-h3">Before edit</h3>
          <p className="pieces-sub">One flat image with body color, pattern, trim, logo, name and number.</p>
          <dl className="info-rows">
            <div className="info-row"><dt>Input</dt><dd>{image.format} · {image.width} × {image.height}</dd></div>
            <div className="info-row">
              <dt><label htmlFor="garment-type">Garment</label></dt>
              <dd>
                <select id="garment-type" value={garment} onChange={(e) => onChangeGarment(e.target.value)} disabled={busy}>
                  {templates.map((t) => <option key={t.key} value={t.key}>{t.label} (piece template)</option>)}
                </select>
              </dd>
            </div>
            <div className="info-row"><dt>Pieces</dt><dd>{capitalize(partNames.join(', '))}</dd></div>
            <div className="info-row"><dt>Export</dt><dd>Layered SVG</dd></div>
          </dl>
          <p className="notice">Piece outlines are placeholders until Terra Printing's own pattern files are added.</p>
        </section>

        <section className="pieces-card" aria-labelledby="tiles-label" aria-busy={busy}>
          <div className="pieces-card-head">
            <div>
              <h2 id="tiles-label">Generated layers by piece</h2>
              <p className="pieces-sub">Separate editable layers, each one cut to the {template?.label.toLowerCase() ?? 'garment'} template</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={onDownload} disabled={!trace.svg || busy}>
              <DownloadIcon width={18} height={18} />
              Download layered SVG
            </button>
          </div>

          {shape && (
            <div className="move-box">
              <label htmlFor="tile-move-to">
                Selected shape is in {GROUPS.find((g) => g.key === shape.layer)?.label} ({SIDE_LABEL[shape.piece] ?? 'whole design'}). Move it to:
              </label>
              <div className="move-row">
                <select id="tile-move-to" value={shape.layer ?? ''} onChange={(e) => onMoveShape(selected, e.target.value)}>
                  {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                </select>
                <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>Done</button>
              </div>
            </div>
          )}

          {busy && <p className="stage-message">Tracing the design and cutting it into pieces…</p>}
          {trace.status === 'error' && <p className="notice" role="alert">{trace.error}</p>}
          {!busy && trace.status === 'done' && !tiles.length && (
            <p className="notice">No garment was found in this image, so it cannot be split into pieces. Use Whole design instead.</p>
          )}

          <ul className="tile-grid">
            {tiles.map((t) => (
              <li key={t.key} className="tile">
                <div className="tile-head">
                  <span className="tile-title">{t.title}</span>
                  <span className="side-tag">{SIDE_LABEL[t.side]}</span>
                </div>
                <div
                  className="tile-stage"
                  role="img"
                  aria-label={`${t.label} layer, ${SIDE_LABEL[t.side].toLowerCase()}`}
                  onClick={pick}
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: selectedStyle(selected, t.indexes) + t.svg }}
                />
              </li>
            ))}
          </ul>
          {tiles.length > 0 && <p className="layers-note">Click a shape in a tile to move it to another layer.</p>}
        </section>
      </div>
    </main>
  );
}

function selectedStyle(selected, indexes) {
  if (selected == null || !indexes.includes(selected)) return '';
  return `<style>.tile-stage [data-i="${selected}"]{stroke:#ec8233;stroke-width:4px;vector-effect:non-scaling-stroke}</style>`;
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

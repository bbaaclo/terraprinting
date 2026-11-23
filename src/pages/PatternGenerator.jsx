import { useEffect, useMemo, useRef, useState } from 'react';
import { Select } from './PageShell.jsx';
import { samplePatternSizes } from '../lib/sampleData.js';
import { downloadFile, update, useData } from '../lib/store.js';
import { getLastDesign } from '../lib/lastDesign.js';
import { SAMPLE_PATTERN, makeSize, readPattern, zipFiles } from '../lib/patternSizes.js';

const BASE_DEFAULT = { Men: 'M', Women: 'M', Child: '10' };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Step 1: set one pattern. Step 2: each size has a preset width and
// height. Step 3: generate every size from the pattern.
export default function PatternGenerator({ garment, group, unit }) {
  const data = useData();
  const fileRef = useRef(null);
  const [pattern, setPattern] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [base, setBase] = useState(BASE_DEFAULT);
  const [off, setOff] = useState({});
  const [draft, setDraft] = useState({});
  const [results, setResults] = useState(null);
  const lastDesign = getLastDesign();

  const rows = data.patternSizes?.[garment]?.[group] ?? [];
  const baseSize = rows.some((r) => r[0] === base[group]) ? base[group] : rows[0]?.[0];
  const baseRow = rows.find((r) => r[0] === baseSize);
  const key = (size) => `${garment}|${group}|${size}`;
  const included = rows.filter((r) => !off[key(r[0])]);
  const u = unit === 'cm' ? 'cm' : 'in';
  const show = (cm) => (unit === 'cm' ? String(Math.round(cm * 10) / 10) : (cm / 2.54).toFixed(1));

  // Anything that changes the output clears old results, so a download
  // always matches what is on screen.
  const settingsKey = useMemo(
    () => JSON.stringify([pattern?.text?.length, pattern?.name, garment, group, baseSize, rows, included.map((r) => r[0])]),
    [pattern, garment, group, baseSize, rows, included],
  );
  useEffect(() => { setResults(null); }, [settingsKey]);
  useEffect(() => () => results?.forEach((r) => URL.revokeObjectURL(r.url)), [results]);

  const loadPattern = (text, name) => {
    try {
      setPattern(readPattern(text, name));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };
  const onFile = async (file) => {
    if (!file) return;
    if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
      setError(`"${file.name}" is not an SVG. Use a layered SVG, for example one downloaded from Design to SVG.`);
      return;
    }
    loadPattern(await file.text(), file.name);
  };

  const commit = (size, col, text) => {
    const n = parseFloat(String(text).replace(',', '.'));
    setDraft((d) => { const next = { ...d }; delete next[`${key(size)}|${col}`]; return next; });
    if (!(n > 0)) return;
    const cm = Math.round((unit === 'cm' ? n : n * 2.54) * 10) / 10;
    update((d) => {
      const row = d.patternSizes[garment][group].find((r) => r[0] === size);
      row[col] = cm;
    });
  };

  const reset = () => update((d) => { d.patternSizes[garment][group] = samplePatternSizes()[garment][group]; });

  const generate = () => {
    if (!pattern) return;
    const out = included.map(([size, w, h]) => {
      const text = makeSize(pattern, w, h);
      return {
        size, w, h, text,
        name: `${slug(pattern.name)}-${slug(group)}-${slug(size)}.svg`,
        url: URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' })),
      };
    });
    setResults(out);
  };

  const maxW = Math.max(...rows.map((r) => r[1]), 1);
  const maxH = Math.max(...rows.map((r) => r[2]), 1);

  return (
    <section className="card card-pad" aria-labelledby="gen-heading">
      <h2 id="gen-heading" className="card-title small">Generate sizes from one pattern</h2>
      <ol className="steps">
        <li><span className={`step-badge${pattern ? ' done' : ''}`}>1</span>Set the pattern</li>
        <li><span className="step-badge done">2</span>Sizes are preset by height and width</li>
        <li><span className={`step-badge${results ? ' done' : ''}`}>3</span>Generate</li>
      </ol>

      <div className="split gen-split">
        {/* Step 1 */}
        <div className="gen-step split-side">
          <h3 className="mini-title"><span className="text-blue">1</span> · Set the pattern</h3>
          <p className="hint">Upload one pattern at the base size. Every other size is made from it.</p>
          <div
            className={`pattern-drop${dragging ? ' is-dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files?.[0]); }}
          >
            {pattern ? (
              <>
                <img className="pattern-preview" alt={`Pattern ${pattern.name}`} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(pattern.text)}`} />
                <strong className="pattern-name">{pattern.name}.svg</strong>
                <span className="hint">{pattern.layers ? `${pattern.layers} layers` : 'SVG pattern'}</span>
              </>
            ) : (
              <>
                <strong>Drop a pattern SVG here</strong>
                <span className="hint">or choose one below</span>
              </>
            )}
          </div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <div className="row-actions top-gap">
            <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>{pattern ? 'Replace pattern' : 'Upload pattern (SVG)'}</button>
            <input ref={fileRef} type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; onFile(f); }} />
            {lastDesign && <button type="button" className="btn btn-secondary" onClick={() => loadPattern(lastDesign.svg, lastDesign.name)}>Use my last design</button>}
            {!pattern && <button type="button" className="btn btn-quiet" onClick={() => loadPattern(SAMPLE_PATTERN, 'sample-jersey-pattern.svg')}>Try a sample pattern</button>}
          </div>
          {!lastDesign && <p className="hint">Tip: trace a design in <a href="#/svg">Design to SVG</a> first, and it shows up here as “Use my last design”.</p>}

          <div className="field top-gap">
            <label htmlFor="base-size">This pattern is size</label>
            <Select id="base-size" value={baseSize ?? ''} onChange={(e) => setBase({ ...base, [group]: e.target.value })}>
              {rows.map((r) => <option key={r[0]} value={r[0]}>{r[0]}</option>)}
            </Select>
            {baseRow && <span className="hint">Made for {show(baseRow[1])} × {show(baseRow[2])} {u} (width × height).</span>}
          </div>
        </div>

        {/* Step 2 */}
        <div className="gen-step split-main">
          <div className="card-head">
            <h3 className="mini-title"><span className="text-blue">2</span> · Preset height and width</h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>Reset to default presets</button>
          </div>
          <p className="hint">Each size’s width and height, measured flat, in {unit === 'cm' ? 'cm' : 'inches'}. Change a number to match your shop, or untick a size you don’t need. Changes are saved.</p>
          <div className="table-box">
            <table className="data-table edit-table">
              <thead>
                <tr>
                  <th scope="col">Make</th><th scope="col">Size</th><th scope="col">Width</th><th scope="col">Height</th>
                  <th scope="col" className="num">Compared with {baseSize}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([size, w, h]) => {
                  const on = !off[key(size)];
                  const isBase = size === baseSize;
                  const cell = (col, cm) => {
                    const dk = `${key(size)}|${col}`;
                    return (
                      <span className="unit-input">
                        <input
                          className="cell-input box num-input"
                          inputMode="decimal"
                          aria-label={`${col === 1 ? 'Width' : 'Height'} of size ${size} in ${u}`}
                          value={draft[dk] ?? show(cm)}
                          onChange={(e) => setDraft({ ...draft, [dk]: e.target.value.replace(/[^0-9.,]/g, '') })}
                          onBlur={(e) => commit(size, col, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        />
                        <span className="muted small">{u}</span>
                      </span>
                    );
                  };
                  return (
                    <tr key={size} className={`${isBase ? 'is-base' : ''}${on ? '' : ' is-off'}`}>
                      <td><input type="checkbox" className="check" aria-label={`Generate size ${size}`} checked={on} onChange={() => setOff({ ...off, [key(size)]: on })} /></td>
                      <th scope="row">{size} {isBase && <span className="tag tag-ongoing">base</span>}</th>
                      <td>{cell(1, w)}</td>
                      <td>{cell(2, h)}</td>
                      <td className="num strong">{isBase ? '100%' : `${Math.round((w / baseRow[1]) * 100)}% wide · ${Math.round((h / baseRow[2]) * 100)}% tall`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="hint">{included.length} of {rows.length} sizes will be generated.</p>
        </div>
      </div>

      {/* Step 3 */}
      <div className="gen-step top-gap">
        <div className="card-head">
          <div>
            <h3 className="mini-title"><span className="text-blue">3</span> · Generate</h3>
            <p className="hint">
              {!pattern ? 'Set a pattern first.' : results ? `${results.length} sizes generated from the ${baseSize} pattern.` : `Makes ${included.length} sizes from the ${baseSize} pattern, using the widths and heights above.`}
            </p>
          </div>
          <div className="row-actions">
            {results?.length > 0 && (
              <button type="button" className="btn btn-secondary" onClick={() => {
                const url = URL.createObjectURL(zipFiles(results.map((r) => ({ name: r.name, text: r.text }))));
                const a = document.createElement('a');
                a.href = url; a.download = `${slug(pattern.name)}-${slug(group)}-all-sizes.zip`; a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1500);
              }}>Download all sizes (ZIP)</button>
            )}
            <button type="button" className="btn btn-primary btn-lg" disabled={!pattern || !included.length} onClick={generate}>
              {results ? 'Generate again' : 'Generate all sizes'}
            </button>
          </div>
        </div>

        {results ? (
          <>
            <div className="gen-grid">
              {results.map((r) => (
                <div key={r.size} className="gen-card">
                  <div className="thumb-box">
                    <img src={r.url} alt={`Size ${r.size}`} style={{ width: `${Math.round(126 * (r.w / maxW))}px`, height: `${Math.round(150 * (r.h / maxH))}px` }} />
                  </div>
                  <strong className="gen-size">{r.size}</strong>
                  <span className="muted small">{show(r.w)} × {show(r.h)} {u}</span>
                  <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={() => downloadFile(r.name, r.text, 'image/svg+xml')}>Download SVG</button>
                </div>
              ))}
            </div>
            <p className="gen-note">Sizes are made by stretching the pattern to each width and height. On very small or very large sizes, check the sleeves and neck before printing.</p>
          </>
        ) : (
          <div className="gen-empty">Press <strong>Generate all sizes</strong> and each size appears here, ready to download.</div>
        )}
      </div>
    </section>
  );
}

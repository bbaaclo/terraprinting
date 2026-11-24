import { GROUPS, groupSummary } from '../lib/layers.js';
import { Select } from '../pages/PageShell.jsx';

const EyeIcon = ({ off }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
);

export default function LayersPanel({ layers, hidden, onToggle, selected, onClearSelection, onMove }) {
  if (!layers) return null;
  const groups = groupSummary(layers.data.paths, layers.assign);
  const selectedGroup = selected != null ? layers.assign[selected] : null;

  return (
    <section className="insp-section" aria-labelledby="layers-label">
      <div className="layers-head">
        <h2 id="layers-label" className="insp-title">Layers</h2>
        <span className="layers-count">{groups.length} layers</span>
      </div>
      <ul className="layer-list">
        {groups.map((g) => {
          const off = hidden.has(g.key);
          return (
            <li key={g.key} className={`layer-row${off ? ' is-hidden' : ''}`}>
              <button
                type="button"
                className="eye"
                aria-pressed={!off}
                aria-label={`${off ? 'Show' : 'Hide'} ${g.label} in the preview`}
                onClick={() => onToggle(g.key)}
              >
                <EyeIcon off={off} />
              </button>
              <span className="swatch" style={{ background: g.swatch ?? 'transparent' }} aria-hidden="true" />
              <span className="layer-name">{g.label}</span>
              <span className="layer-shapes">{g.count === 0 ? 'None found' : `${g.count} ${g.count === 1 ? 'shape' : 'shapes'}`}</span>
            </li>
          );
        })}
      </ul>

      {selected != null ? (
        <div className="move-box">
          <label htmlFor="move-to">Selected shape is in {GROUPS.find((g) => g.key === selectedGroup)?.label}. Move it to:</label>
          <div className="move-row">
            <Select id="move-to" className="grow" value={selectedGroup ?? ''} onChange={(e) => onMove(selected, e.target.value)}>
              {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </Select>
            <button type="button" className="btn btn-secondary" onClick={onClearSelection}>Done</button>
          </div>
        </div>
      ) : (
        <p className="layers-note">Click a shape in the result to move it. The eye hides a layer in the preview only.</p>
      )}
    </section>
  );
}

import { useState } from 'react';
import PageShell, { Segmented, Select, SizesNav } from './PageShell.jsx';
import { GARMENTS, GROUPS, sampleCharts } from '../lib/sampleData.js';
import { formatDate, update, useData } from '../lib/store.js';

const COLS = ['Chest', 'Waist', 'Neck', 'Body length', 'Shoulder'];
const fmt = (cm, unit) => (cm === '' || cm == null ? '—' : unit === 'cm' ? String(cm) : (cm / 2.54).toFixed(1));

// Picks the smallest size whose chest, waist and neck all fit the customer.
function findSize(rows, m) {
  const need = [['chest', 1], ['waist', 2], ['neck', 3]].filter(([k]) => m[k] > 0);
  if (!need.length) return null;
  const fits = rows.find((r) => need.every(([k, col]) => Number(r[col]) >= m[k]));
  if (!fits) return { size: rows[rows.length - 1][0], reason: 'Bigger than the largest size on the chart. Check with the customer.', tooBig: true };
  const parts = need.map(([k, col]) => {
    const first = rows.find((r) => Number(r[col]) >= m[k]);
    return `${k} fits ${first[0]}`;
  });
  const firsts = need.map(([k, col]) => rows.find((r) => Number(r[col]) >= m[k])[0]);
  if (firsts.every((f) => f === fits[0])) {
    return { size: fits[0], reason: `${need.map(([k]) => k[0].toUpperCase() + k.slice(1)).join(', ')} all fit ${fits[0]}.` };
  }
  const decided = need.find((_, i) => firsts[i] === fits[0]);
  return { size: fits[0], reason: `${parts.join(', ')}. ${fits[0]} is suggested so the ${decided[0]} fits.` };
}

export default function SizeChart() {
  const data = useData();
  const [garment, setGarment] = useState(GARMENTS[0]);
  const [group, setGroup] = useState('Men');
  const [unit, setUnit] = useState('cm');
  const [editing, setEditing] = useState(null); // rows being edited (cm)
  const [m, setM] = useState({ chest: '', waist: '', neck: '', height: '' });
  const [result, setResult] = useState(null);
  const [orderId, setOrderId] = useState('');
  const [added, setAdded] = useState('');

  const rows = data.charts[garment]?.[group] ?? [];
  const openOrders = data.orders.filter((o) => !o.due || o.due >= new Date().toISOString().slice(0, 10));

  const save = () => {
    update((d) => { d.charts[garment][group] = editing.map((r) => [r[0], ...r.slice(1).map((v) => (v === '' ? '' : Number(v)))]); });
    setEditing(null);
  };

  const runFinder = () => {
    const toCm = (v) => (v === '' ? 0 : unit === 'cm' ? Number(v) : Number(v) * 2.54);
    setResult(findSize(rows, { chest: toCm(m.chest), waist: toCm(m.waist), neck: toCm(m.neck) }));
    setAdded('');
  };

  const addToOrder = () => {
    const order = data.orders.find((o) => o.id === orderId);
    if (!order || !result) return;
    const cm = (v) => (v === '' ? '' : Math.round(unit === 'cm' ? Number(v) : Number(v) * 2.54));
    update((d) => {
      d.orders.find((o) => o.id === orderId).players.push({ name: '', number: '', group, size: result.size, neck: cm(m.neck), waist: cm(m.waist), note: '' });
    });
    const cust = data.customers.find((c) => c.id === order.customerId);
    setAdded(`Added a ${group.toLowerCase()} ${result.size} to ${cust?.name ?? 'the order'}. Fill in the name and number there.`);
  };

  return (
    <PageShell title="Customer Sizes">
      <SizesNav current="sizes" />
      <div className="split">
        <section className="card card-pad split-main" aria-labelledby="chart-title">
          <div className="card-head">
            <h1 id="chart-title" className="card-title">Size chart</h1>
            <div className="row-actions">
              <label htmlFor="garment" className="field-label-inline">Garment</label>
              <Select id="garment" value={garment} onChange={(e) => { setGarment(e.target.value); setEditing(null); setResult(null); }}>
                {GARMENTS.map((g) => <option key={g}>{g}</option>)}
              </Select>
              {editing ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={save}>Save chart</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                </>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(structuredClone(rows))}>Edit chart</button>
              )}
            </div>
          </div>

          <div className="row-actions between top-gap">
            <Segmented label="Who the sizes are for" options={GROUPS.map((g) => ({ value: g, label: g }))} value={group} onChange={(g) => { setGroup(g); setEditing(null); setResult(null); }} />
            {!editing && <Segmented label="Units" options={[{ value: 'cm', label: 'cm' }, { value: 'in', label: 'in' }]} value={unit} onChange={(u) => { setUnit(u); setResult(null); setAdded(''); }} />}
          </div>
          <p className="hint">
            {group === 'Child' ? 'Kids’ sizes, by age.' : `Adult sizes, ${group === 'Men' ? 'men’s' : 'women’s'} cut.`}{' '}
            {editing ? 'Editing in cm.' : `Measurements in ${unit === 'cm' ? 'cm' : 'inches'}.`}
            {data.sample || JSON.stringify(rows) === JSON.stringify(sampleCharts()[garment][group]) ? ' These are sample values. Replace them with your shop’s chart in Edit chart.' : ''}
          </p>

          <div className="table-box">
            <table className="data-table">
              <thead>
                <tr><th scope="col">Size</th>{COLS.map((c) => <th key={c} scope="col" className="num">{c}</th>)}</tr>
              </thead>
              <tbody>
                {(editing ?? rows).map((r, i) => (
                  <tr key={i}>
                    <th scope="row">{r[0]}</th>
                    {COLS.map((c, j) => (
                      <td key={c} className="num">
                        {editing ? (
                          <input
                            className="cell-input"
                            inputMode="decimal"
                            aria-label={`${c} for size ${r[0]} in cm`}
                            value={editing[i][j + 1]}
                            onChange={(e) => setEditing((rs) => rs.map((row, k) => (k === i ? row.map((v, l) => (l === j + 1 ? e.target.value : v)) : row)))}
                          />
                        ) : fmt(r[j + 1], unit)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="card card-pad split-side" aria-labelledby="finder-title">
          <h2 id="finder-title" className="card-title small">Find a customer's size</h2>
          <p className="hint">Enter body measurements in {unit === 'cm' ? 'cm' : 'inches'}. The size comes from the {group.toLowerCase()} {garment.toLowerCase()} chart.</p>
          <div className="form-grid">
            {['chest', 'waist', 'neck', 'height'].map((k) => (
              <div key={k} className="field">
                <label htmlFor={`m-${k}`}>{k[0].toUpperCase() + k.slice(1)}</label>
                <input id={`m-${k}`} inputMode="decimal" value={m[k]} placeholder={unit} onChange={(e) => setM({ ...m, [k]: e.target.value.replace(/[^0-9.]/g, '') })} />
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-block top-gap" onClick={runFinder} disabled={!m.chest && !m.waist && !m.neck}>Find size</button>

          {result && (
            <div className={`result-box${result.tooBig ? ' warn' : ''}`} role="status">
              <span className="result-label">Suggested size</span>
              <span className="result-size">{result.size} <small>{group === 'Child' ? 'kids' : `${group.toLowerCase()}’s cut`}</small></span>
              <span className="result-reason">{result.reason}</span>
            </div>
          )}

          {result && openOrders.length > 0 && (
            <div className="add-box">
              <label htmlFor="add-order">Add to a team order</label>
              <div className="row-actions">
                <Select id="add-order" value={orderId} onChange={(e) => setOrderId(e.target.value)} className="grow">
                  <option value="">Choose an order…</option>
                  {openOrders.map((o) => (
                    <option key={o.id} value={o.id}>{data.customers.find((c) => c.id === o.customerId)?.name ?? 'Order'} · due {formatDate(o.due)}</option>
                  ))}
                </Select>
                <button type="button" className="btn btn-secondary" disabled={!orderId} onClick={addToOrder}>Add</button>
              </div>
              {added && <p className="hint ok">{added}</p>}
            </div>
          )}
        </aside>
      </div>
    </PageShell>
  );
}

import { useRef, useState } from 'react';
import PageShell, { Select, SizesNav } from './PageShell.jsx';
import { GARMENTS, GROUPS } from '../lib/sampleData.js';
import { downloadFile, formatDate, uid, update, useData } from '../lib/store.js';
import { go } from '../App.jsx';

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4', '6', '8', '10', '12', '14', '16'];
const CSV_HEAD = ['Name on jersey', 'Number', 'For', 'Size', 'Neck (cm)', 'Waist (cm)', 'Notes'];

function toCsv(players) {
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  return [CSV_HEAD, ...players.map((p) => [p.name, p.number, p.group, p.size, p.neck, p.waist, p.note])].map((r) => r.map(esc).join(',')).join('\n');
}

function fromCsv(text) {
  const rows = [];
  let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const body = rows.filter((r) => r.some((c) => c.trim()));
  if (body.length && /name/i.test(body[0][0])) body.shift();
  return body.map((r) => {
    const group = GROUPS.find((g) => g.toLowerCase() === (r[2] || '').trim().toLowerCase()) ?? 'Men';
    return { name: (r[0] || '').trim().toUpperCase(), number: (r[1] || '').trim(), group, size: (r[3] || '').trim().toUpperCase(), neck: r[4] ? Number(r[4]) || '' : '', waist: r[5] ? Number(r[5]) || '' : '', note: (r[6] || '').trim() };
  });
}

function NewOrderForm({ customers, onCancel }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? 'new');
  const [newName, setNewName] = useState('');
  const [garment, setGarment] = useState(GARMENTS[0]);
  const [due, setDue] = useState('');
  const create = () => {
    const id = uid('o');
    update((d) => {
      let cid = customerId;
      if (cid === 'new') {
        cid = uid('c');
        d.customers.push({ id: cid, name: newName.trim(), kind: '', contact: '', phone: '', address: '', since: String(new Date().getFullYear()) });
      }
      d.orders.push({ id, customerId: cid, garment, due, createdAt: new Date().toISOString().slice(0, 10), players: [] });
    });
    go(`/orders/${id}`);
    onCancel();
  };
  return (
    <section className="card card-pad top-gap" aria-labelledby="new-order-title">
      <h2 id="new-order-title" className="card-title small">New team order</h2>
      <div className="form-grid four">
        <div className="field">
          <label htmlFor="no-customer">Customer</label>
          <Select id="no-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="new">+ New customer…</option>
          </Select>
        </div>
        {customerId === 'new' && (
          <div className="field">
            <label htmlFor="no-name">New customer name</label>
            <input id="no-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Team, school or company" />
          </div>
        )}
        <div className="field">
          <label htmlFor="no-garment">Garment</label>
          <Select id="no-garment" value={garment} onChange={(e) => setGarment(e.target.value)}>
            {GARMENTS.map((g) => <option key={g}>{g}</option>)}
          </Select>
        </div>
        <div className="field">
          <label htmlFor="no-due">Due date</label>
          <input id="no-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
      <div className="row-actions top-gap">
        <button type="button" className="btn btn-primary" disabled={customerId === 'new' && !newName.trim()} onClick={create}>Create order</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}

export default function TeamOrders({ id }) {
  const data = useData();
  const importRef = useRef(null);
  const [creating, setCreating] = useState(false);
  const sorted = [...data.orders].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const order = data.orders.find((o) => o.id === id) ?? sorted[0];
  const customer = order && data.customers.find((c) => c.id === order.customerId);

  const setPlayer = (i, key, value) => update((d) => { d.orders.find((o) => o.id === order.id).players[i][key] = value; });
  const addPlayer = () => update((d) => { d.orders.find((o) => o.id === order.id).players.push({ name: '', number: '', group: 'Men', size: '', neck: '', waist: '', note: '' }); });
  const removePlayer = (i) => update((d) => { d.orders.find((o) => o.id === order.id).players.splice(i, 1); });
  const setOrder = (key, value) => update((d) => { d.orders.find((o) => o.id === order.id)[key] = value; });

  const importCsv = async (file) => {
    const players = fromCsv(await file.text());
    if (!players.length) { alert('No players were found in that file.'); return; }
    update((d) => { d.orders.find((o) => o.id === order.id).players.push(...players); });
  };

  const players = order?.players ?? [];
  const byGroup = Object.fromEntries(GROUPS.map((g) => [g, players.filter((p) => p.group === g).length]));
  const sizeCounts = {};
  for (const p of players) if (p.size) { const key = p.group === 'Child' ? `Kids ${p.size}` : p.size; sizeCounts[key] = (sizeCounts[key] || 0) + 1; }
  const sizeKeys = Object.keys(sizeCounts).sort((a, b) => SIZE_ORDER.indexOf(a.replace('Kids ', '')) - SIZE_ORDER.indexOf(b.replace('Kids ', '')) || a.localeCompare(b));

  return (
    <PageShell title="Customer Sizes">
      <SizesNav current="orders" />

      <div className="row-actions between top-gap">
        <div className="row-actions">
          {sorted.length > 0 && (
            <>
              <label htmlFor="pick-order" className="field-label-inline">Order</label>
              <Select id="pick-order" value={order?.id ?? ''} onChange={(e) => go(`/orders/${e.target.value}`)}>
                {sorted.map((o) => <option key={o.id} value={o.id}>{data.customers.find((c) => c.id === o.customerId)?.name ?? 'Order'} · {o.garment}</option>)}
              </Select>
            </>
          )}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>New team order</button>
      </div>

      {creating && <NewOrderForm customers={data.customers} onCancel={() => setCreating(false)} />}

      {!order ? (
        <p className="empty">No team orders yet. Click <strong>New team order</strong> to start one.</p>
      ) : (
        <>
          <div className="order-head">
            <div>
              <span className="eyebrow-label">Team order</span>
              <h1 className="page-title small">{customer?.name ?? 'Customer'}</h1>
              <p className="hint">
                {order.garment} · Due {formatDate(order.due)}
                {customer?.contact ? ` · Contact ${customer.contact}${customer.phone ? `, ${customer.phone}` : ''}` : ''}
              </p>
            </div>
            <div className="row-actions">
              <button type="button" className="btn btn-secondary" onClick={() => importRef.current?.click()}>Import list</button>
              <input ref={importRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importCsv(f); }} />
              <button type="button" className="btn btn-secondary" disabled={!players.length} onClick={() => downloadFile(`${(customer?.name ?? 'team').replace(/\W+/g, '-').toLowerCase()}-players.csv`, toCsv(players), 'text/csv')}>Export list</button>
              <button type="button" className="btn btn-primary" onClick={addPlayer}>Add player</button>
            </div>
          </div>

          <div className="split">
            <section className="card split-main" aria-label="Players">
              <div className="table-box flush">
                <table className="data-table edit-table">
                  <thead>
                    <tr>
                      <th scope="col">#</th><th scope="col">Name on jersey</th><th scope="col">Number</th><th scope="col">For</th>
                      <th scope="col">Size</th><th scope="col" className="num">Neck</th><th scope="col" className="num">Waist</th><th scope="col">Notes</th><th scope="col"><span className="sr-only">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p, i) => (
                      <tr key={i}>
                        <td className="muted">{i + 1}</td>
                        <td><input className="cell-input wide strong" aria-label={`Name for player ${i + 1}`} value={p.name} placeholder="NAME" onChange={(e) => setPlayer(i, 'name', e.target.value.toUpperCase())} /></td>
                        <td><input className="cell-input narrow strong" aria-label={`Number for player ${i + 1}`} value={p.number} placeholder="00" onChange={(e) => setPlayer(i, 'number', e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} /></td>
                        <td>
                          <Select className="compact" aria-label={`Who player ${i + 1} is`} value={p.group} onChange={(e) => setPlayer(i, 'group', e.target.value)}>
                            {GROUPS.map((g) => <option key={g}>{g}</option>)}
                          </Select>
                        </td>
                        <td><input className="cell-input narrow strong" aria-label={`Size for player ${i + 1}`} value={p.size} placeholder="M" onChange={(e) => setPlayer(i, 'size', e.target.value.toUpperCase())} /></td>
                        <td className="num"><input className="cell-input narrow" inputMode="decimal" aria-label={`Neck in cm for player ${i + 1}`} value={p.neck} placeholder="cm" onChange={(e) => setPlayer(i, 'neck', e.target.value.replace(/[^0-9.]/g, ''))} /></td>
                        <td className="num"><input className="cell-input narrow" inputMode="decimal" aria-label={`Waist in cm for player ${i + 1}`} value={p.waist} placeholder="cm" onChange={(e) => setPlayer(i, 'waist', e.target.value.replace(/[^0-9.]/g, ''))} /></td>
                        <td><input className="cell-input wide" aria-label={`Notes for player ${i + 1}`} value={p.note} placeholder="—" onChange={(e) => setPlayer(i, 'note', e.target.value)} /></td>
                        <td><button type="button" className="icon-btn" aria-label={`Remove player ${i + 1}`} onClick={() => removePlayer(i)}>×</button></td>
                      </tr>
                    ))}
                    <tr>
                      <td className="muted">{players.length + 1}</td>
                      <td colSpan={8}><button type="button" className="btn btn-dashed" onClick={addPlayer}>+ Add another player</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="card card-pad split-side" aria-labelledby="totals-title">
              <h2 id="totals-title" className="card-title small">Order totals</h2>
              <p className="hint">Counted from the player list, for production.</p>
              <div className="stat-tiles three">
                {GROUPS.map((g) => (
                  <div key={g} className={`tile tile-${g.toLowerCase()}`}><span>{g}</span><strong>{byGroup[g]}</strong></div>
                ))}
              </div>
              <h3 className="mini-title">By size · {players.length} {players.length === 1 ? 'piece' : 'pieces'}</h3>
              {sizeKeys.length ? (
                <div className="size-chips">
                  {sizeKeys.map((k) => <span key={k}><strong>{k}</strong> · {sizeCounts[k]}</span>)}
                </div>
              ) : <p className="hint">Sizes appear here as you fill them in.</p>}

              <div className="field top-gap">
                <label htmlFor="order-due">Due date</label>
                <input id="order-due" type="date" value={order.due ?? ''} onChange={(e) => setOrder('due', e.target.value)} />
              </div>
              <div className="field top-gap">
                <label htmlFor="order-garment">Garment</label>
                <Select id="order-garment" value={order.garment} onChange={(e) => setOrder('garment', e.target.value)}>
                  {GARMENTS.map((g) => <option key={g}>{g}</option>)}
                </Select>
              </div>
              <a className="btn btn-secondary btn-block top-gap" href={`#/customers/${order.customerId}`}>View customer</a>
            </aside>
          </div>
        </>
      )}
    </PageShell>
  );
}

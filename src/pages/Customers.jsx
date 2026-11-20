import { useState } from 'react';
import PageShell, { GroupTag, SizesNav, StatusPill } from './PageShell.jsx';
import { formatDate, paidAmount, peso, todayIso, uid, update, useData } from '../lib/store.js';
import { go } from '../App.jsx';

const FIELDS = [
  ['name', 'Name'], ['kind', 'Type (team, school, company…)'], ['contact', 'Contact person'], ['phone', 'Phone'], ['address', 'Address'],
];

function CustomerForm({ initial, onSave, onCancel, title }) {
  const [form, setForm] = useState(initial);
  return (
    <section className="card card-pad" aria-labelledby="cust-form-title">
      <h2 id="cust-form-title" className="card-title small">{title}</h2>
      <div className="form-grid">
        {FIELDS.map(([k, label]) => (
          <div key={k} className="field">
            <label htmlFor={`cf-${k}`}>{label}</label>
            <input id={`cf-${k}`} value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="row-actions top-gap">
        <button type="button" className="btn btn-primary" disabled={!form.name?.trim()} onClick={() => onSave(form)}>Save</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}

export default function Customers({ id }) {
  const data = useData();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState(null); // 'edit' | 'new'

  const stats = (c) => {
    const projects = data.projects.filter((p) => p.customerId === c.id);
    const orders = data.orders.filter((o) => o.customerId === c.id);
    const today = todayIso();
    const dates = [...projects.map((p) => p.pickedUp || p.due), ...orders.map((o) => o.createdAt)].filter((d) => d && d <= today).sort();
    return { projects, orders, last: dates[dates.length - 1] };
  };
  const q = query.trim().toLowerCase();
  const list = data.customers
    .filter((c) => !q || [c.name, c.kind, c.contact, c.phone].some((v) => (v || '').toLowerCase().includes(q)))
    .map((c) => ({ ...c, ...stats(c) }))
    .sort((a, b) => (b.last ?? '').localeCompare(a.last ?? ''));
  const current = data.customers.find((c) => c.id === id) ?? list[0];
  const info = current && stats(current);
  const latestOrder = info && [...info.orders].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0];
  const pieces = info ? info.projects.filter((p) => p.status === 'completed').reduce((a, p) => a + p.pieces, 0) : 0;
  const owed = info ? info.projects.reduce((a, p) => a + (p.price - paidAmount(p)), 0) : 0;

  const reorder = () => {
    const newId = uid('o');
    update((d) => {
      d.orders.push({
        id: newId, customerId: current.id, garment: latestOrder?.garment ?? 'Basketball jersey', due: '',
        createdAt: new Date().toISOString().slice(0, 10), players: structuredClone(latestOrder?.players ?? []),
      });
    });
    go(`/orders/${newId}`);
  };

  return (
    <PageShell title="Customer Sizes">
      <SizesNav current="customers" />
      <div className="split">
        <section className="card card-pad split-side left" aria-labelledby="list-title">
          <div className="card-head">
            <h1 id="list-title" className="card-title small">Previous customers</h1>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode('new')}>New</button>
          </div>
          <label htmlFor="cust-search" className="field-label">Search</label>
          <input id="cust-search" type="search" className="input" placeholder="Name, team or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
          <ul className="pick-list">
            {list.map((c) => (
              <li key={c.id}>
                <a href={`#/customers/${c.id}`} className="pick-item" aria-current={c.id === current?.id ? 'true' : undefined}>
                  <span className="pick-top"><strong>{c.name}</strong><span>{c.kind}</span></span>
                  <span className="pick-sub">{c.last ? `Last activity ${formatDate(c.last)}` : 'No orders yet'} · {c.projects.length} {c.projects.length === 1 ? 'project' : 'projects'}</span>
                </a>
              </li>
            ))}
            {!list.length && <li className="hint">No customers found.</li>}
          </ul>
        </section>

        <div className="split-main stack">
          {mode === 'new' && (
            <CustomerForm
              title="New customer"
              initial={{ name: '', kind: '', contact: '', phone: '', address: '' }}
              onCancel={() => setMode(null)}
              onSave={(f) => { const cid = uid('c'); update((d) => { d.customers.push({ ...f, id: cid, since: String(new Date().getFullYear()) }); }); setMode(null); go(`/customers/${cid}`); }}
            />
          )}
          {mode === 'edit' && current && (
            <CustomerForm
              title="Edit details"
              initial={current}
              onCancel={() => setMode(null)}
              onSave={(f) => { update((d) => { Object.assign(d.customers.find((c) => c.id === current.id), f); }); setMode(null); }}
            />
          )}

          {!current ? (
            <p className="empty">No customers yet. Add one with <strong>New</strong>, or create a team order.</p>
          ) : (
            <>
              <section className="card card-pad" aria-labelledby="detail-title">
                <div className="card-head">
                  <div>
                    <span className="eyebrow-label">{current.kind || 'Customer'}</span>
                    <h2 id="detail-title" className="page-title small">{current.name}</h2>
                    <p className="hint">{[current.contact, current.phone, current.address].filter(Boolean).join(' · ') || 'No contact details yet.'}</p>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setMode('edit')}>Edit details</button>
                    <button type="button" className="btn btn-primary" onClick={reorder}>{latestOrder ? 'Reorder with these sizes' : 'New team order'}</button>
                  </div>
                </div>
                <div className="stat-tiles four top-gap">
                  <div className="tile"><span>Projects</span><strong>{info.projects.length}</strong></div>
                  <div className="tile"><span>Pieces delivered</span><strong>{pieces}</strong></div>
                  <div className="tile"><span>Players saved</span><strong>{latestOrder?.players.length ?? 0}</strong></div>
                  <div className="tile"><span>Balance owed</span><strong className={owed > 0 ? 'text-danger' : ''}>{peso(owed)}</strong></div>
                </div>
              </section>

              <section className="card card-pad" aria-labelledby="history-title">
                <h3 id="history-title" className="card-title small">Past and current projects</h3>
                {info.projects.length ? (
                  <div className="table-box top-gap">
                    <table className="data-table">
                      <thead><tr><th scope="col">Due</th><th scope="col">Garment</th><th scope="col" className="num">Pieces</th><th scope="col">Design file</th><th scope="col">Status</th><th scope="col">Picked up</th></tr></thead>
                      <tbody>
                        {[...info.projects].sort((a, b) => (b.due ?? '').localeCompare(a.due ?? '')).map((p) => (
                          <tr key={p.id}>
                            <td className="nowrap strong">{formatDate(p.due)}</td>
                            <td>{p.garment}</td>
                            <td className="num">{p.pieces}</td>
                            <td className="muted">{p.file || '—'}</td>
                            <td><StatusPill status={p.status} /></td>
                            <td className="nowrap">{p.pickedUp ? `${formatDate(p.pickedUp)} · ${p.pickedBy}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="hint">No projects for this customer yet.</p>}
              </section>

              <section className="card card-pad" aria-labelledby="saved-title">
                <div className="card-head">
                  <h3 id="saved-title" className="card-title small">Saved player sizes</h3>
                  {latestOrder && <a href={`#/orders/${latestOrder.id}`} className="hint">From the {latestOrder.garment.toLowerCase()} order · open it</a>}
                </div>
                {latestOrder?.players.length ? (
                  <div className="table-box top-gap">
                    <table className="data-table">
                      <thead><tr><th scope="col">Name on jersey</th><th scope="col">Number</th><th scope="col">For</th><th scope="col">Size</th><th scope="col" className="num">Neck</th><th scope="col" className="num">Waist</th></tr></thead>
                      <tbody>
                        {latestOrder.players.map((p, i) => (
                          <tr key={i}>
                            <td className="strong">{p.name || '—'}</td>
                            <td className="strong">{p.number || '—'}</td>
                            <td><GroupTag group={p.group} /></td>
                            <td className="strong">{p.size || '—'}</td>
                            <td className="num muted">{p.neck ? `${p.neck} cm` : '—'}</td>
                            <td className="num muted">{p.waist ? `${p.waist} cm` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="hint">No player sizes saved yet.</p>}
              </section>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}

import { useState } from 'react';
import PageShell, { Segmented, Select, StatusPill } from './PageShell.jsx';
import { STAGES, WAITING_REASONS } from '../lib/sampleData.js';
import { daysUntil, formatDate, paidAmount, peso, todayIso, uid, update, useData } from '../lib/store.js';

const PAY = [
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Down payment' },
  { value: 'unpaid', label: 'Not paid' },
];

function ProjectForm({ data, initial, onClose }) {
  const [f, setF] = useState(initial);
  const [newCustomer, setNewCustomer] = useState('');
  const set = (k, v) => setF({ ...f, [k]: v });
  const save = () => {
    update((d) => {
      let customerId = f.customerId;
      if (customerId === 'new') {
        customerId = uid('c');
        d.customers.push({ id: customerId, name: newCustomer.trim(), kind: '', contact: '', phone: '', address: '', since: String(new Date().getFullYear()) });
      }
      const clean = { ...f, customerId, pieces: Number(f.pieces) || 0, price: Number(f.price) || 0, stage: Number(f.stage) || 0 };
      const i = d.projects.findIndex((p) => p.id === f.id);
      if (i >= 0) d.projects[i] = clean; else d.projects.push(clean);
    });
    onClose();
  };
  const remove = () => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    update((d) => { d.projects = d.projects.filter((p) => p.id !== f.id); });
    onClose();
  };
  const isNew = !data.projects.some((p) => p.id === f.id);
  const valid = (f.customerId !== 'new' || newCustomer.trim()) && f.garment.trim() && f.due;

  return (
    <section className="card card-pad top-gap" aria-labelledby="pf-title">
      <h2 id="pf-title" className="card-title small">{isNew ? 'New project' : 'Edit project'}</h2>
      <div className="form-grid four">
        <div className="field">
          <label htmlFor="pf-customer">Customer</label>
          <Select id="pf-customer" value={f.customerId} onChange={(e) => set('customerId', e.target.value)}>
            {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="new">+ New customer…</option>
          </Select>
        </div>
        {f.customerId === 'new' && (
          <div className="field"><label htmlFor="pf-newc">New customer name</label><input id="pf-newc" value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} /></div>
        )}
        <div className="field"><label htmlFor="pf-garment">Garment</label><input id="pf-garment" value={f.garment} onChange={(e) => set('garment', e.target.value)} placeholder="Basketball jersey" /></div>
        <div className="field"><label htmlFor="pf-pieces">Pieces</label><input id="pf-pieces" inputMode="numeric" value={f.pieces} onChange={(e) => set('pieces', e.target.value.replace(/\D/g, ''))} /></div>
        <div className="field"><label htmlFor="pf-price">Total price (₱)</label><input id="pf-price" inputMode="numeric" value={f.price} onChange={(e) => set('price', e.target.value.replace(/\D/g, ''))} /></div>
        <div className="field"><label htmlFor="pf-due">Due date</label><input id="pf-due" type="date" value={f.due} onChange={(e) => set('due', e.target.value)} /></div>
        <div className="field"><label htmlFor="pf-owner">Handled by</label><input id="pf-owner" value={f.owner} onChange={(e) => set('owner', e.target.value)} /></div>
        <div className="field">
          <label htmlFor="pf-status">Status</label>
          <Select id="pf-status" value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="pending">Pending</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option>
          </Select>
        </div>
        {f.status === 'pending' && (
          <div className="field">
            <label htmlFor="pf-wait">Waiting for</label>
            <Select id="pf-wait" value={f.waiting ?? WAITING_REASONS[0]} onChange={(e) => set('waiting', e.target.value)}>
              {WAITING_REASONS.map((w) => <option key={w}>{w}</option>)}
            </Select>
          </div>
        )}
        {f.status === 'ongoing' && (
          <div className="field">
            <label htmlFor="pf-stage">Stage</label>
            <Select id="pf-stage" value={f.stage} onChange={(e) => set('stage', Number(e.target.value))}>
              {STAGES.map((s, i) => <option key={s} value={i}>{s}</option>)}
            </Select>
          </div>
        )}
        {f.status === 'completed' && (
          <>
            <div className="field"><label htmlFor="pf-pdate">Picked up on</label><input id="pf-pdate" type="date" value={f.pickedUp ?? ''} onChange={(e) => set('pickedUp', e.target.value)} /></div>
            <div className="field"><label htmlFor="pf-pby">Picked up by</label><input id="pf-pby" value={f.pickedBy ?? ''} onChange={(e) => set('pickedBy', e.target.value)} /></div>
          </>
        )}
        <div className="field">
          <label htmlFor="pf-pay">Payment</label>
          <Select id="pf-pay" value={f.pay} onChange={(e) => set('pay', e.target.value)}>{PAY.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>
        </div>
        <div className="field"><label htmlFor="pf-file">Design file (optional)</label><input id="pf-file" value={f.file ?? ''} onChange={(e) => set('file', e.target.value)} placeholder="team-jersey.svg" /></div>
      </div>
      <p className="hint">Down payment counts as half of the total price.</p>
      <div className="row-actions top-gap">
        <button type="button" className="btn btn-primary" disabled={!valid} onClick={save}>{isNew ? 'Create project' : 'Save changes'}</button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        {!isNew && <button type="button" className="btn btn-danger-quiet" onClick={remove}>Delete project</button>}
      </div>
    </section>
  );
}

export default function Projects() {
  const data = useData();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [pickup, setPickup] = useState(null); // project id
  const [pickName, setPickName] = useState('');

  const name = (p) => data.customers.find((c) => c.id === p.customerId)?.name ?? 'Customer';
  const all = data.projects;
  const q = query.trim().toLowerCase();
  const order = { ongoing: 0, pending: 1, completed: 2 };
  const shown = all
    .filter((p) => filter === 'all' || p.status === filter)
    .filter((p) => !q || `${name(p)} ${p.garment}`.toLowerCase().includes(q))
    .sort((a, b) => order[a.status] - order[b.status] || (a.status === 'completed' ? (b.pickedUp ?? '').localeCompare(a.pickedUp ?? '') : (a.due ?? '').localeCompare(b.due ?? '')));
  const balanceTotal = all.reduce((a, p) => a + (p.price - paidAmount(p)), 0);
  const notPaid = all.filter((p) => p.pay !== 'paid').length;

  const setP = (id, patch) => update((d) => { Object.assign(d.projects.find((p) => p.id === id), patch); });
  const pp = all.find((p) => p.id === pickup);
  const ppBalance = pp ? pp.price - paidAmount(pp) : 0;
  const release = (markPaid) => {
    setP(pickup, { status: 'completed', pickedUp: todayIso(), pickedBy: pickName.trim() || 'Customer representative', ...(markPaid ? { pay: 'paid' } : {}) });
    setPickup(null);
    setPickName('');
  };

  const blank = { id: uid('p'), customerId: data.customers[0]?.id ?? 'new', garment: '', pieces: '', price: '', status: 'pending', waiting: WAITING_REASONS[0], stage: 0, due: '', owner: '', pay: 'unpaid', file: '' };

  return (
    <PageShell title="Projects" actions={<button type="button" className="btn btn-primary" onClick={() => setEditing(blank)}>New project</button>}>
      <h1 className="page-title small">Projects</h1>
      <p className="hint">Every job, from waiting to picked up, with its payment status.</p>

      <div className="stat-tiles five top-gap">
        <div className="tile card"><span>Ongoing</span><strong className="text-blue">{all.filter((p) => p.status === 'ongoing').length}</strong></div>
        <div className="tile card"><span>Pending</span><strong className="text-orange">{all.filter((p) => p.status === 'pending').length}</strong></div>
        <div className="tile card"><span>Completed</span><strong className="text-green">{all.filter((p) => p.status === 'completed').length}</strong></div>
        <div className="tile card"><span>Due this week</span><strong>{all.filter((p) => p.status !== 'completed' && p.due && daysUntil(p.due) <= 7).length}</strong></div>
        <div className="tile card"><span>Balance to collect</span><strong className="text-danger">{peso(balanceTotal)}</strong><small>{notPaid} {notPaid === 1 ? 'project' : 'projects'} not fully paid</small></div>
      </div>

      {editing && <ProjectForm key={editing.id} data={data} initial={editing} onClose={() => setEditing(null)} />}

      <section className="card card-pad top-gap" aria-labelledby="plist-title">
        <div className="card-head">
          <h2 id="plist-title" className="card-title small">Project list</h2>
          <div className="row-actions">
            <Segmented label="Show projects" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'ongoing', label: 'Ongoing' }, { value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Completed' }]} />
            <label htmlFor="p-search" className="field-label-inline">Search</label>
            <input id="p-search" type="search" className="input" placeholder="Customer or garment" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        {pp && (
          <div className={`pickup-box${ppBalance > 0 ? ' warn' : ''}`} role="alertdialog" aria-labelledby="pickup-title">
            <h3 id="pickup-title">{ppBalance > 0 ? `Balance of ${peso(ppBalance)} is still due` : `Release ${pp.garment}`}</h3>
            <p>
              {ppBalance > 0
                ? `${name(pp)} has paid ${peso(paidAmount(pp))} of ${peso(pp.price)}. Collect the balance before releasing the ${pp.pieces} pieces, or record that they were picked up with a balance.`
                : `${name(pp)} has paid in full. Record who picked up the ${pp.pieces} pieces.`}
            </p>
            <div className="row-actions bottom">
              <div className="field">
                <label htmlFor="picked-by">Picked up by</label>
                <input id="picked-by" value={pickName} onChange={(e) => setPickName(e.target.value)} placeholder="Full name" />
              </div>
              {ppBalance > 0 ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => release(true)}>Mark paid and picked up</button>
                  <button type="button" className="btn btn-secondary" onClick={() => release(false)}>Picked up with balance</button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => release(false)}>Mark as picked up</button>
              )}
              <button type="button" className="btn btn-quiet" onClick={() => { setPickup(null); setPickName(''); }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="table-box top-gap">
          <table className="data-table projects-table">
            <thead>
              <tr>
                <th scope="col">Project</th><th scope="col">Status and stage</th>
                <th scope="col" className="nowrap">Due</th><th scope="col" className="num">Total</th><th scope="col" className="num">Paid</th><th scope="col" className="num">Balance</th>
                <th scope="col">Payment</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const left = p.due ? daysUntil(p.due) : null;
                const urgent = p.status !== 'completed' && left != null && left <= 3;
                const paid = paidAmount(p);
                const balance = p.price - paid;
                const pct = p.status === 'completed' ? 100 : p.status === 'pending' ? 0 : Math.round(((p.stage + 1) / 6) * 100);
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="project-name">
                        <strong>{name(p)}</strong>
                        <button type="button" className="link-btn" aria-label={`Edit ${name(p)}, ${p.garment}`} onClick={() => setEditing({ ...p })}>Edit</button>
                      </span>
                      <span className="sub">{p.garment} · {p.pieces} pcs</span>
                      {p.owner && <span className="sub">Handled by {p.owner}</span>}
                    </td>
                    <td className="stage-cell">
                      <StatusPill status={p.status} />
                      <span className="block strong small stage-name">
                        {p.status === 'ongoing' ? STAGES[p.stage] : p.status === 'pending' ? p.waiting : `Picked up ${formatDate(p.pickedUp)}`}
                      </span>
                      <span className="bar"><span className={`bar-fill ${p.status}`} style={{ width: `${pct}%` }} /></span>
                      <span className="sub">
                        {p.status === 'ongoing' ? `Step ${p.stage + 2} of 7` : p.status === 'pending' ? 'Not started' : `by ${p.pickedBy}`}
                      </span>
                      {p.status === 'pending' && <button type="button" className="btn btn-xs" onClick={() => setP(p.id, { status: 'ongoing', stage: 0 })}>Start work</button>}
                      {p.status === 'ongoing' && p.stage < 4 && <button type="button" className="btn btn-xs" onClick={() => setP(p.id, { stage: p.stage + 1 })}>Next: {STAGES[p.stage + 1]}</button>}
                      {p.status === 'ongoing' && p.stage === 4 && <button type="button" className="btn btn-xs" onClick={() => { setPickup(p.id); setPickName(''); }}>Mark as picked up</button>}
                    </td>
                    <td className="nowrap">
                      <span className="block strong">{formatDate(p.due)}</span>
                      <span className={`sub${urgent ? ' urgent' : ''}`}>
                        {p.status === 'completed' ? 'Done' : left == null ? '' : left < 0 ? `${-left} days late` : left === 0 ? 'Due today' : `${left} ${left === 1 ? 'day' : 'days'} left`}
                      </span>
                    </td>
                    <td className="num nowrap">{peso(p.price)}</td>
                    <td className="num nowrap muted">{peso(paid)}</td>
                    <td className="num nowrap">{balance > 0 ? <strong className="text-danger">{peso(balance)}</strong> : <span className="muted">—</span>}</td>
                    <td className="nowrap">
                      <Select className={`compact pay-${p.pay}`} aria-label={`Payment for ${name(p)}`} value={p.pay} onChange={(e) => setP(p.id, { pay: e.target.value })}>
                        {PAY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                      {p.status === 'completed' && balance > 0 && <span className="sub urgent">Released with balance</span>}
                    </td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={7} className="empty-cell">No projects here yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="hint top-gap">Stages: Waiting → Design → Printing → Sewing → Quality check → Ready for pickup → Picked up.</p>
      </section>
    </PageShell>
  );
}

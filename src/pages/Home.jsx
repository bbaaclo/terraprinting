import { useEffect, useRef, useState } from 'react';
import PageShell from './PageShell.jsx';
import { daysUntil, downloadFile, formatDate, removeSampleData, replaceAll, todayIso, useData } from '../lib/store.js';

// Counts up to `target` once, for the live numbers in the hero.
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(target); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const JERSEY = 'M72 22 C88 46 152 46 168 22 L198 32 C194 72 204 98 222 112 L222 272 L18 272 L18 112 C36 98 46 72 42 32 Z';

// One plate per layer of the finished SVG: they fly together, the stack
// turns to face you, a print pass sweeps over it, then it comes apart again.
function JerseyStack() {
  const plate = (id, children, i, label) => (
    <div className="layer" style={{ '--i': i }} key={id}>
      <svg viewBox="0 0 240 290" aria-hidden="true">
        <defs><clipPath id={`clip-${id}`}><path d={JERSEY} /></clipPath></defs>
        <path className="plate" d={JERSEY} />
        {children(`url(#clip-${id})`)}
      </svg>
      <span className="layer-tag">{label}</span>
    </div>
  );
  return (
    <div className="stack-stage" role="img" aria-label="A jersey design built from five layers: color, pattern, logo, name and number">
      <div className="stack-shadow" />
      <div className="jersey-stack">
        {plate('color', () => <path d={JERSEY} fill="#2f4fa3" />, 0, 'Color')}
        {plate('pattern', (clip) => (
          <g clipPath={clip}>
            <path d="M-20 300 L120 120 L160 120 L20 300 Z" fill="#ec8233" />
            <path d="M40 300 L180 120 L200 120 L60 300 Z" fill="#f0af3d" />
            <path d="M150 300 L260 160 L260 210 L190 300 Z" fill="#3e82d8" />
            <path d={JERSEY} fill="none" stroke="#f0af3d" strokeWidth="9" />
          </g>
        ), 1, 'Pattern')}
        {plate('logo', () => (
          <g transform="translate(146 62) scale(1.05)">
            <path d="M4 6l10 5v10L4 26z" fill="#ec8233" /><path d="M14 11l-6 3V6z" fill="#f0af3d" />
            <path d="M28 6L18 11v10l10 5z" fill="#ffffff" /><path d="M18 21l6-3v8z" fill="#cfe0f7" />
          </g>
        ), 2, 'Logo')}
        {plate('name', () => <text x="120" y="122" textAnchor="middle" className="jersey-name">TERRA</text>, 3, 'Name')}
        {plate('number', () => <text x="120" y="232" textAnchor="middle" className="jersey-number">10</text>, 4, 'Number')}
      </div>
      <div className="print-scan" />
    </div>
  );
}

const CARDS = [
  {
    href: '#/svg', title: 'Design to SVG', tone: 'blue', cta: 'Start a design',
    text: 'Drop in a customer’s design and get it back as clean layers: Color, Pattern, Logo, Name and Number.',
    icon: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,
  },
  {
    href: '#/sizes', title: 'Customer Sizes', tone: 'orange', cta: 'Open sizes',
    text: 'Size charts for men, women and kids, a size finder, team orders and every previous customer.',
    icon: <path d="M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4" />,
  },
  {
    href: '#/projects', title: 'Projects', tone: 'green', cta: 'View projects',
    text: 'Every job from waiting to picked up: stage, due date, payment, and who collected it.',
    icon: <path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 9h8M8 13h8M8 17h5" />,
  },
];

export default function Home() {
  const data = useData();
  const importRef = useRef(null);

  const open = data.projects.filter((p) => p.status !== 'completed');
  const ongoing = data.projects.filter((p) => p.status === 'ongoing').length;
  const dueWeek = open.filter((p) => p.due && daysUntil(p.due) <= 7).length;
  const pending = data.projects.filter((p) => p.status === 'pending').length;
  const ongoingN = useCountUp(ongoing);
  const pendingN = useCountUp(pending);
  const dueN = useCountUp(dueWeek);
  const nextDue = [...open].filter((p) => p.due).sort((a, b) => a.due.localeCompare(b.due))[0];
  const nextDueName = nextDue && data.customers.find((c) => c.id === nextDue.customerId)?.name;
  const lastOrder = [...data.orders].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0];
  const lastOrderCustomer = lastOrder && data.customers.find((c) => c.id === lastOrder.customerId);

  const cardStats = {
    '#/svg': '5 layers · runs in your browser',
    '#/sizes': `${data.customers.length} customers · ${data.orders.length} team orders`,
    '#/projects': `${ongoing} ongoing · ${pending} pending · ${dueWeek} due this week`,
  };

  const importBackup = async (file) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.customers)) throw new Error('not a backup file');
      replaceAll(parsed);
    } catch (err) {
      alert(`That file could not be imported (${err.message}).`);
    }
  };

  return (
    <PageShell title="Home">
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-greeting">{greeting()} · {formatDate(todayIso())}</p>
          <h1 className="hero-title">From customer design <span className="hero-accent">to finished print.</span></h1>
          <p className="page-lede">Turn designs into print-ready layers, keep every customer’s sizes, and follow each job until it’s picked up.</p>
          <div className="row-actions top-gap">
            <a href="#/svg" className="btn btn-primary btn-lg">Start a design</a>
            <a href="#/projects" className="btn btn-secondary btn-lg">View projects</a>
          </div>

          <dl className="hero-stats">
            <div><dt>Ongoing jobs</dt><dd className="text-blue">{ongoingN}</dd></div>
            <div><dt>Pending</dt><dd className={pending ? 'text-orange' : ''}>{pendingN}</dd></div>
            <div><dt>Due this week</dt><dd className={dueWeek ? 'text-orange' : ''}>{dueN}</dd></div>
          </dl>
          {nextDue && (
            <p className="hero-next">
              <span className="pulse-dot" aria-hidden="true" />
              Next due: <a href="#/projects">{nextDueName}</a> · {nextDue.garment} · {formatDate(nextDue.due)}
            </p>
          )}
        </div>
        <JerseyStack />
      </section>

      <div className="feature-grid">
        {CARDS.map((c, i) => (
          <a key={c.href} href={c.href} className={`feature-card tone-${c.tone}`} style={{ '--d': `${i * 90}ms` }}>
            <span className={`home-icon tone-${c.tone}`}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{c.icon}</svg>
            </span>
            <span className="feature-title">{c.title}</span>
            <span className="feature-text">{c.text}</span>
            <span className="feature-stat">{cardStats[c.href]}</span>
            <span className={`feature-cta cta-${c.tone}`}>
              {c.cta}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </span>
          </a>
        ))}
      </div>

      {lastOrder && (
        <p className="home-recent">
          <span className="dot" /> Latest team order: <a href={`#/orders/${lastOrder.id}`}>{lastOrderCustomer?.name ?? 'Customer'}</a> · {lastOrder.players.length} players · due {formatDate(lastOrder.due)}
        </p>
      )}

      <section className="data-box" aria-labelledby="data-title">
        <div className="data-box-text">
          <h2 id="data-title">Your data</h2>
          <p>Saved in this browser on this computer. Export a backup now and then to keep a copy.{data.sample ? ' Sample customers and projects are loaded so you can try everything.' : ''}</p>
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn-secondary" onClick={() => downloadFile(`terra-printing-backup-${todayIso()}.json`, JSON.stringify(data, null, 2), 'application/json')}>Export backup</button>
          <button type="button" className="btn btn-secondary" onClick={() => importRef.current?.click()}>Import backup</button>
          <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importBackup(f); }} />
          {data.sample && (
            <button type="button" className="btn btn-danger-quiet" onClick={() => { if (confirm('Remove all sample customers, orders and projects? Your size charts stay.')) removeSampleData(); }}>
              Remove sample data
            </button>
          )}
        </div>
      </section>
    </PageShell>
  );
}

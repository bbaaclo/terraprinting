import AppHeader from '../components/AppHeader.jsx';

// Header + page body used by Home, Customer Sizes and Projects.
export default function PageShell({ title, actions, children }) {
  return (
    <>
      <AppHeader title={title}>
        {actions}
        {title !== 'Home' && <a className="btn btn-secondary" href="#/">Back to home</a>}
      </AppHeader>
      <main className="page">{children}</main>
    </>
  );
}

export function SizesNav({ current }) {
  const tabs = [
    { key: 'sizes', href: '#/sizes', label: 'Size chart' },
    { key: 'orders', href: '#/orders', label: 'Team orders' },
    { key: 'customers', href: '#/customers', label: 'Previous customers' },
  ];
  return (
    <nav className="tabs" aria-label="Customer Sizes sections">
      {tabs.map((t) => (
        <a key={t.key} href={t.href} className="tab" aria-current={t.key === current ? 'page' : undefined}>{t.label}</a>
      ))}
    </nav>
  );
}

export function Segmented({ label, options, value, onChange }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className="seg-btn" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// A dropdown with its arrow set in from the right edge.
export function Select({ className = '', children, ...props }) {
  return (
    <span className={`select-wrap ${className}`}>
      <select {...props}>{children}</select>
      <svg className="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </span>
  );
}

export function StatusPill({ status }) {
  const label = { ongoing: 'Ongoing', pending: 'Pending', completed: 'Completed' }[status];
  return <span className={`tag tag-${status}`}>{label}</span>;
}

export function GroupTag({ group }) {
  return <span className={`tag tag-${group.toLowerCase()}`}>{group}</span>;
}

import BrandMark from './BrandMark.jsx';

// Shared top bar. The brand links back to the Home screen.
export default function AppHeader({ children, title = 'Design to SVG' }) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <a className="brand brand-link" href="#/" aria-label="Terra Printing home">
          <BrandMark />
          <span className="brand-divider" aria-hidden="true" />
          <span className="product-name">{title}</span>
        </a>
        <div className="header-side">{children}</div>
      </div>
      <div className="ribbon" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
    </header>
  );
}

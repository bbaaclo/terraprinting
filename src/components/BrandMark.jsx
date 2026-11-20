import { useState } from 'react';

// Shows the company logo from public/brand-logo.png when that file exists.
// Until then it falls back to a simple two-ribbon mark in the brand colors.
export default function BrandMark() {
  const [hasLogo, setHasLogo] = useState(true);

  if (hasLogo) {
    return (
      <img
        className="brand-logo"
        src="/brand-logo.png"
        alt="Terra Printing"
        onError={() => setHasLogo(false)}
      />
    );
  }

  return (
    <span className="brand-fallback">
      <svg className="brand-ribbons" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 6l10 5v10L4 26z" fill="var(--orange)" />
        <path d="M14 11l-6 3V6z" fill="var(--amber)" />
        <path d="M28 6L18 11v10l10 5z" fill="var(--blue)" />
        <path d="M18 21l6-3v8z" fill="var(--sky)" />
      </svg>
      <span className="brand-word">Terra Printing</span>
    </span>
  );
}

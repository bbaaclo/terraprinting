// Small line icons used across the app (24px grid, currentColor).
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const LockIcon = (p) => (
  <svg {...base} {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const UploadIcon = (p) => (
  <svg {...base} {...p}><path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v4h16v-4" /></svg>
);
export const SparkIcon = (p) => (
  <svg {...base} {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" /></svg>
);
export const GradientIcon = (p) => (
  <svg {...base} {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 4v16M14 4v16" /></svg>
);
export const TextShapeIcon = (p) => (
  <svg {...base} {...p}><path d="M5 7V5h14v2M12 5v14M9 19h6" /></svg>
);
export const DownloadIcon = (p) => (
  <svg {...base} {...p}><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M4 15v4h16v-4" /></svg>
);
export const ImageIcon = (p) => (
  <svg {...base} {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 16l-5-5-8 8.5" /></svg>
);

// The most recent layered SVG made in Design to SVG during this browser
// session, so the Size chart can use it as a pattern without re-uploading.
const KEY = 'terra-last-design';
let last = null;

export function setLastDesign(design) {
  last = design;
  try { sessionStorage.setItem(KEY, JSON.stringify(design)); } catch { /* too big for storage: keep it in memory only */ }
}

export function getLastDesign() {
  if (last) return last;
  try { const raw = sessionStorage.getItem(KEY); if (raw) last = JSON.parse(raw); } catch { /* ignore */ }
  return last;
}

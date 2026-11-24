// The shop's records (customers, team orders, projects, size charts),
// saved in this browser on this computer (localStorage). Nothing is sent
// anywhere. Use Export backup on the Home screen to keep a copy.
import { useSyncExternalStore } from 'react';
import { emptyData, sampleData, samplePatternSizes } from './sampleData.js';
import { DEFAULT_TEMPLATES } from './garmentTemplates.js';

// v2: sample names changed to clearly made-up ones, so every browser
// (including yours) starts again from the new sample data.
const KEY = 'terra-printing-data-v2';
const listeners = new Set();
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Data saved before the size generator existed gets the default presets.
      if (!saved.patternSizes) saved.patternSizes = samplePatternSizes();
      return withTemplates(saved);
    }
  } catch {
    /* fall through to sample data */
  }
  return withTemplates(sampleData());
}

// Garment piece templates (sleeves, collar) for Design to SVG. Data saved
// before templates existed gets the default (placeholder) ones.
function withTemplates(data) {
  return data.garmentTemplates ? data : { ...data, garmentTemplates: structuredClone(DEFAULT_TEMPLATES) };
}

// The current data, for code outside React components.
export function getData() {
  return state;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Could not save data:', err);
  }
}

// Changes the data. `change` gets a copy to modify; the copy becomes the
// new state, is saved, and every page using it re-renders.
export function update(change) {
  const next = structuredClone(state);
  change(next);
  state = next;
  save();
  listeners.forEach((l) => l());
}

export function replaceAll(data) {
  state = withTemplates(data.patternSizes ? data : { ...data, patternSizes: samplePatternSizes() });
  save();
  listeners.forEach((l) => l());
}

// Keeps the size charts (they may have been edited); clears the rest.
export const removeSampleData = () => replaceAll({ ...emptyData(), charts: state.charts, patternSizes: state.patternSizes, garmentTemplates: state.garmentTemplates });

export function useData() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
  );
}

export function uid(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---- small shared helpers ----
export const peso = (n) => `₱${Math.round(n || 0).toLocaleString('en-US')}`;

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysUntil(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86400000);
}

export function paidAmount(project) {
  if (project.pay === 'paid') return project.price;
  if (project.pay === 'partial') return Math.round(project.price / 2);
  return 0;
}

export function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

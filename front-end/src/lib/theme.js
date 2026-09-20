export const THEME_KEY = 'transly-theme-v1';

const listeners = new Set();

function isTheme(value) {
  return value === 'light' || value === 'dark';
}

function readDom() {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function readStored() {
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

function preferTheme() {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', theme === 'light' ? '#f3f1ea' : '#0c0d0b');
}

let current = readDom();

export function getTheme() {
  return current;
}

export function subscribeTheme(onStoreChange) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function setTheme(next) {
  current = next;
  applyTheme(next);
  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore quota */
  }
  listeners.forEach((fn) => fn());
}

export function toggleTheme() {
  setTheme(current === 'light' ? 'dark' : 'light');
}

export function hydrateTheme() {
  const next = readStored() ?? preferTheme();
  if (next !== current) setTheme(next);
  else applyTheme(next);
}

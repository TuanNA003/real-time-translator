export const ENGINES = [
  { id: 'grok', label: 'Grok', hint: 'Natural' },
  { id: 'google', label: 'Google', hint: 'Fast' },
  { id: 'chatgpt', label: 'ChatGPT', hint: 'Paid plan', pro: true },
  { id: 'gemini', label: 'Gemini', hint: 'Paid plan', pro: true },
];

const STORAGE_KEY = 'loi-engine-v1';

export function isActiveEngine(id) {
  return id === 'grok' || id === 'google';
}

export function engineById(id) {
  return ENGINES.find((engine) => engine.id === id) ?? ENGINES[0];
}

export function loadEngine() {
  if (typeof window === 'undefined') return 'grok';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return isActiveEngine(raw) ? raw : 'grok';
}

export function saveEngine(id) {
  window.localStorage.setItem(STORAGE_KEY, id);
}

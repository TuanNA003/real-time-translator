const CURRENT_KEY = 'loi-current-v1';
const SESSIONS_KEY = 'loi-sessions-v1';
const MAX_SESSIONS = 24;

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function loadCurrent() {
  const draft = readJson(CURRENT_KEY, null);
  if (!draft || !Array.isArray(draft.lines)) return null;
  return draft;
}

export function saveCurrent(draft) {
  window.localStorage.setItem(CURRENT_KEY, JSON.stringify(draft));
}

export function clearCurrent() {
  window.localStorage.removeItem(CURRENT_KEY);
}

export function loadSessions() {
  const list = readJson(SESSIONS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function archiveDraft(draft) {
  if (!draft.lines.length) return loadSessions();
  const session = {
    ...draft,
    id: crypto.randomUUID(),
    savedAt: Date.now(),
  };
  const next = [session, ...loadSessions()].slice(0, MAX_SESSIONS);
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
  return next;
}

export function deleteSession(id) {
  const next = loadSessions().filter((item) => item.id !== id);
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
  return next;
}

export function sessionPreview(session) {
  return session.lines[0]?.source ?? 'Empty session';
}

export function exportText(lines) {
  return lines.map((line) => `${line.source}\n${line.target}`).join('\n\n');
}

export function exportTargets(lines) {
  return lines
    .map((line) => (line.target || '').trim())
    .filter(Boolean)
    .join('\n');
}

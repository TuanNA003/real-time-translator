const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function readError(response) {
  const detail = await response.text();
  return detail || `Request failed (${response.status})`;
}

export async function translateText({ text, source, target }) {
  const response = await fetch(`${API_BASE}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      source_language: source,
      target_language: target,
    }),
  });

  if (!response.ok) {
    return { ok: false, error: await readError(response) };
  }

  const data = await response.json();
  return { ok: true, translated: data.translated_text ?? '', engine: data.engine ?? 'google' };
}

export async function transcribeAndTranslate({ audioBase64, mime, language, target }) {
  const response = await fetch(`${API_BASE}/api/transcribe-and-translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_data: audioBase64,
      mime,
      source_language: language,
      target_language: target,
    }),
  });

  if (!response.ok) {
    return { ok: false, error: await readError(response) };
  }

  const data = await response.json();
  return {
    ok: true,
    transcribed: data.transcribed_text ?? '',
    translated: data.translated_text ?? '',
  };
}

export async function punctuateText(text) {
  const response = await fetch(`${API_BASE}/api/punctuate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    return { ok: false, error: await readError(response), text };
  }

  const data = await response.json();
  return { ok: true, text: data.text ?? text };
}

export async function speakText({ text, language }) {
  const response = await fetch(`${API_BASE}/api/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
  });

  if (!response.ok) {
    return { ok: false, error: await readError(response) };
  }

  const data = await response.json();
  return {
    ok: true,
    audioBase64: data.audio_base64 ?? '',
    mime: data.mime ?? 'audio/mpeg',
  };
}

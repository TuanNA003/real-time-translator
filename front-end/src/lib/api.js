const API_BASE = import.meta.env.VITE_API_URL ?? '';

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
    const detail = await response.text();
    return { ok: false, error: detail || `Translate failed (${response.status})` };
  }

  const data = await response.json();
  return { ok: true, translated: data.translated_text ?? '' };
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
    const detail = await response.text();
    return { ok: false, error: detail || `Transcribe failed (${response.status})` };
  }

  const data = await response.json();
  return {
    ok: true,
    transcribed: data.transcribed_text ?? '',
    translated: data.translated_text ?? '',
  };
}

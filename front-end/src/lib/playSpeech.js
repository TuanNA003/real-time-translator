import { speakText } from './api';

let currentAudio = null;

export function stopSpeech() {
  currentAudio?.pause();
  currentAudio = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

async function applySink(audio, sinkId) {
  if (!sinkId || sinkId === 'default' || typeof audio.setSinkId !== 'function') return;
  try {
    await audio.setSinkId(sinkId);
  } catch {
    /* play on system default */
  }
}

export async function playSpeech(text, language, speechLocale, sinkId) {
  stopSpeech();
  const result = await speakText({ text, language });
  if (result.ok) {
    const audio = new Audio(`data:${result.mime};base64,${result.audioBase64}`);
    currentAudio = audio;
    await applySink(audio, sinkId);
    await audio.play();
    await new Promise((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
    });
    return;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  await new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocale;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

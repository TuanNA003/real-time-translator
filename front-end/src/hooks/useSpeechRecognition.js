import { useCallback, useEffect, useRef, useState } from 'react';

function getSpeechCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useSpeechRecognition(lang) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const wantRef = useRef(false);
  const recRef = useRef(null);
  const langRef = useRef(lang);
  const onFinalRef = useRef(() => {});

  useEffect(() => {
    langRef.current = lang;
    if (recRef.current) recRef.current.lang = lang;
  }, [lang]);

  useEffect(() => {
    const Ctor = getSpeechCtor();
    setSupported(Boolean(Ctor));
    if (!Ctor) return undefined;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = langRef.current;

    rec.onstart = () => {
      setListening(true);
      setError(null);
    };
    rec.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setError(event.error === 'not-allowed' ? 'Microphone permission denied.' : event.error);
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
      if (wantRef.current) {
        window.setTimeout(() => {
          if (!wantRef.current || !recRef.current) return;
          try {
            recRef.current.lang = langRef.current;
            recRef.current.start();
          } catch {
            /* already started */
          }
        }, 120);
      }
    };
    rec.onresult = (event) => {
      let nextInterim = '';
      let nextFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i];
        const text = piece[0].transcript;
        if (piece.isFinal) nextFinal += text;
        else nextInterim += text;
      }
      setInterim(nextInterim);
      const trimmed = nextFinal.trim();
      if (trimmed) onFinalRef.current(trimmed);
    };

    recRef.current = rec;
    return () => {
      wantRef.current = false;
      rec.onstart = rec.onend = rec.onerror = rec.onresult = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (!recRef.current) {
      setError('Speech recognition is not available in this browser.');
      return;
    }
    wantRef.current = true;
    setError(null);
    recRef.current.lang = langRef.current;
    try {
      recRef.current.start();
    } catch {
      /* already started */
    }
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
    setInterim('');
  }, []);

  const setOnFinal = useCallback((fn) => {
    onFinalRef.current = fn;
  }, []);

  return { supported, listening, interim, error, start, stop, setOnFinal };
}

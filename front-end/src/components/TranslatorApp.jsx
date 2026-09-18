import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Copy,
  Download,
  Headphones,
  History,
  Mic,
  MicOff,
  Monitor,
  RotateCcw,
  Send,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { LANGUAGES, languageById } from '../lib/languages';
import { punctuateText, transcribeAndTranslate, translateText } from '../lib/api';
import {
  archiveDraft,
  clearCurrent,
  deleteSession,
  exportText,
  loadCurrent,
  loadSessions,
  saveCurrent,
  sessionPreview,
} from '../lib/history';
import { playSpeech, stopSpeech } from '../lib/playSpeech';
import { BROWSER_MIC_ID, DEFAULT_OUTPUT_ID, useAudioDevices } from '../hooks/useAudioDevices';
import { useMicAudio } from '../hooks/useMicAudio';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useTabAudio } from '../hooks/useTabAudio';

function LanguageField({ id, label, value, exclude, onChange }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
      >
        {LANGUAGES.filter((lang) => lang.id !== exclude).map((lang) => (
          <option key={lang.id} value={lang.id}>
            {lang.native}
          </option>
        ))}
      </select>
    </label>
  );
}

function DeviceField({ id, label, value, options, onChange, onFocus }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => onFocus?.()}
        className="h-11 w-full appearance-none rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((device) => (
          <option key={device.id} value={device.id}>
            {device.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function IconButton({ onClick, label, disabled, pressed, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      className={`inline-flex size-11 items-center justify-center rounded-md text-fg-muted hover:bg-surface hover:text-fg disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export default function TranslatorApp() {
  const [sourceId, setSourceId] = useState('en');
  const [targetId, setTargetId] = useState('vi');
  const [typed, setTyped] = useState('');
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('mic');
  const [status, setStatus] = useState('Choose a mic, a headset, or a meeting tab.');
  const [readAloud, setReadAloud] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [speakingId, setSpeakingId] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const source = languageById(sourceId);
  const target = languageById(targetId);
  const speech = useSpeechRecognition(source.speech);
  const tab = useTabAudio();
  const mic = useMicAudio();
  const devices = useAudioDevices();
  const translatingRef = useRef(false);
  const transcribingRef = useRef(false);
  const queueRef = useRef([]);
  const audioQueueRef = useRef([]);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const lastSpokenRef = useRef(null);
  const sourceCodeRef = useRef(source.translate);
  const targetCodeRef = useRef(target.translate);
  const targetSpeechRef = useRef(target.speech);
  const outputIdRef = useRef(devices.outputId);
  sourceCodeRef.current = source.translate;
  targetCodeRef.current = target.translate;
  targetSpeechRef.current = target.speech;
  outputIdRef.current = devices.outputId;
  const live = speech.listening || tab.capturing || mic.capturing;
  const usingDeviceMic = mode === 'mic' && !devices.usingBrowserMic;

  useEffect(() => {
    const draft = loadCurrent();
    if (draft?.lines?.length) {
      setSourceId(draft.sourceId);
      setTargetId(draft.targetId);
      setLines(draft.lines);
      setStatus('Restored last session.');
    }
    setSessions(loadSessions());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveCurrent({ sourceId, targetId, lines });
  }, [hydrated, sourceId, targetId, lines]);

  const swap = () => {
    setSourceId(targetId);
    setTargetId(sourceId);
  };

  const speakLine = useCallback(async (line) => {
    setSpeakingId(line.id);
    setStatus('Reading translation…');
    try {
      await playSpeech(line.target, targetCodeRef.current, targetSpeechRef.current, outputIdRef.current);
      setStatus('Ready');
    } catch {
      setStatus('Could not play audio.');
    } finally {
      setSpeakingId(null);
    }
  }, []);

  const pushLine = useCallback(async (text) => {
    queueRef.current.push(text);
    if (translatingRef.current) return;
    translatingRef.current = true;
    setBusy(true);
    while (queueRef.current.length) {
      const next = queueRef.current.shift();
      setStatus('Restoring punctuation…');
      const polished = await punctuateText(next);
      const sourceText = polished.ok ? polished.text : next;
      setStatus('Translating…');
      const result = await translateText({
        text: sourceText,
        source: sourceCodeRef.current,
        target: targetCodeRef.current,
      });
      if (result.ok) {
        setLines((prev) => [...prev, { id: crypto.randomUUID(), source: sourceText, target: result.translated }]);
        const listening = mode === 'meeting' ? 'Capturing tab audio…' : 'Listening';
        setStatus(result.engine === 'grok' ? `${listening} · Grok` : listening);
      } else {
        setStatus(result.error);
      }
    }
    translatingRef.current = false;
    setBusy(false);
  }, [mode]);

  const handleAudioChunk = useCallback(async (base64, mime) => {
    audioQueueRef.current.push({ base64, mime });
    if (transcribingRef.current) return;
    transcribingRef.current = true;
    setBusy(true);
    while (audioQueueRef.current.length) {
      const next = audioQueueRef.current.shift();
      setStatus('Transcribing…');
      const result = await transcribeAndTranslate({
        audioBase64: next.base64,
        mime: next.mime,
        language: sourceCodeRef.current,
        target: targetCodeRef.current,
      });
      if (!result.ok) {
        setStatus(result.error);
        continue;
      }
      if (!result.transcribed) {
        setStatus(mode === 'meeting' ? 'Capturing tab audio…' : 'Listening');
        continue;
      }
      setLines((prev) => [...prev, { id: crypto.randomUUID(), source: result.transcribed, target: result.translated }]);
      setStatus(mode === 'meeting' ? 'Capturing tab audio…' : 'Listening');
    }
    transcribingRef.current = false;
    setBusy(false);
  }, [mode]);

  useEffect(() => {
    speech.setOnFinal((text) => {
      void pushLine(text);
    });
  }, [speech, pushLine]);

  useEffect(() => {
    tab.setOnChunk((base64, mime) => {
      void handleAudioChunk(base64, mime);
    });
  }, [tab, handleAudioChunk]);

  useEffect(() => {
    mic.setOnChunk((base64, mime) => {
      void handleAudioChunk(base64, mime);
    });
  }, [mic, handleAudioChunk]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines, speech.interim]);

  useEffect(() => {
    if (!readAloud || !lines.length) return;
    const last = lines[lines.length - 1];
    if (lastSpokenRef.current === last.id) return;
    lastSpokenRef.current = last.id;
    void speakLine(last);
  }, [lines, readAloud, speakLine]);

  const stopAllCapture = () => {
    speech.stop();
    tab.stop();
    mic.stop();
  };

  const setCaptureMode = (next) => {
    if (next === mode) return;
    stopAllCapture();
    setMode(next);
    setStatus(next === 'mic' ? 'Microphone — pick a device, then Start.' : 'Meeting — share a tab and enable audio.');
  };

  const startMicCapture = async () => {
    await devices.ensurePermission();
    if (devices.usingBrowserMic) {
      speech.start();
      setStatus('Listening');
      return;
    }
    const ok = await mic.start(devices.inputId);
    if (ok) setStatus(`Listening · ${devices.inputLabel}`);
  };

  const toggleCapture = async () => {
    if (live) {
      stopAllCapture();
      setStatus('Paused');
      return;
    }
    if (mode === 'mic') {
      await startMicCapture();
      return;
    }
    await tab.start();
    setStatus('Share a Chrome tab and tick Share audio.');
  };

  const changeInput = (id) => {
    devices.setInputId(id);
    if (mode !== 'mic' || !live) return;
    stopAllCapture();
    window.setTimeout(() => {
      void (async () => {
        if (id === BROWSER_MIC_ID) {
          speech.start();
          setStatus('Listening');
          return;
        }
        const ok = await mic.start(id);
        if (ok) setStatus('Listening');
      })();
    }, 80);
  };

  const toggleReadAloud = () => {
    const next = !readAloud;
    setReadAloud(next);
    if (!next) {
      stopSpeech();
      setSpeakingId(null);
      setStatus('Read aloud off.');
      return;
    }
    setStatus('Read aloud on — new translations will play.');
  };

  const submitTyped = async () => {
    const text = typed.trim();
    if (!text) return;
    setTyped('');
    await pushLine(text);
  };

  const copyAll = async () => {
    const blob = exportText(lines);
    if (!blob) return;
    await navigator.clipboard.writeText(blob);
    setStatus('Copied');
  };

  const downloadAll = () => {
    const blob = new Blob([exportText(lines)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `loi-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Downloaded');
  };

  const reset = () => {
    stopAllCapture();
    stopSpeech();
    if (lines.length) setSessions(archiveDraft({ sourceId, targetId, lines }));
    setLines([]);
    setTyped('');
    clearCurrent();
    lastSpokenRef.current = null;
    setStatus('Cleared — previous session kept in history.');
  };

  const restoreSession = (session) => {
    if (lines.length) setSessions(archiveDraft({ sourceId, targetId, lines }));
    setSourceId(session.sourceId);
    setTargetId(session.targetId);
    setLines(session.lines);
    setHistoryOpen(false);
    setStatus('Session restored.');
  };

  const removeSession = (id) => {
    setSessions(deleteSession(id));
  };

  const inputOptions = [{ id: BROWSER_MIC_ID, label: 'Browser microphone (live)' }, ...devices.inputs];
  if (devices.inputId !== BROWSER_MIC_ID && !inputOptions.some((d) => d.id === devices.inputId)) {
    inputOptions.push({ id: devices.inputId, label: devices.inputLabel });
  }
  const selectedInput = inputOptions.some((d) => d.id === devices.inputId) ? devices.inputId : BROWSER_MIC_ID;
  const selectedOutput = devices.outputs.some((d) => d.id === devices.outputId) ? devices.outputId : DEFAULT_OUTPUT_ID;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-[11px] tracking-[0.22em] text-sage uppercase">Listen from any device</p>
          <h1 className="font-display text-4xl leading-none tracking-tight text-fg sm:text-5xl">Lời</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-fg-muted">
            Pick a mic or headset to speak. Share a tab to caption speakers. Play the other side through headphones.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton onClick={toggleReadAloud} label={readAloud ? 'Turn off read aloud' : 'Read translations aloud'} pressed={readAloud} className={readAloud ? 'text-sage' : ''}>
            {readAloud ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </IconButton>
          <IconButton onClick={() => setHistoryOpen(true)} label="Session history">
            <History className="size-4" />
          </IconButton>
          <IconButton onClick={copyAll} label="Copy transcript" disabled={!lines.length}>
            <Copy className="size-4" />
          </IconButton>
          <IconButton onClick={downloadAll} label="Download transcript" disabled={!lines.length} className="hidden sm:inline-flex">
            <Download className="size-4" />
          </IconButton>
          <IconButton onClick={reset} label="Clear">
            <RotateCcw className="size-4" />
          </IconButton>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-elevated p-4 sm:p-5">
        <div className="mb-4 flex rounded-md border border-border p-1">
          <button
            type="button"
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-sm text-sm ${mode === 'mic' ? 'bg-surface text-fg' : 'text-fg-muted'}`}
            onClick={() => setCaptureMode('mic')}
          >
            <Mic className="size-4" /> Microphone
          </button>
          <button
            type="button"
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-sm text-sm ${mode === 'meeting' ? 'bg-surface text-fg' : 'text-fg-muted'}`}
            onClick={() => setCaptureMode('meeting')}
          >
            <Monitor className="size-4" /> Meeting tab
          </button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <LanguageField id="source-lang" label="Heard as" value={sourceId} exclude={targetId} onChange={setSourceId} />
          <button
            type="button"
            className="mx-auto inline-flex size-11 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface hover:text-fg sm:mb-0.5"
            onClick={swap}
            aria-label="Swap languages"
          >
            <ArrowLeftRight className="size-4" />
          </button>
          <LanguageField id="target-lang" label="Written as" value={targetId} exclude={sourceId} onChange={setTargetId} />
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {mode === 'mic' ? (
            <DeviceField
              id="audio-input"
              label="Listen from"
              value={selectedInput}
              options={inputOptions}
              onChange={changeInput}
              onFocus={() => void devices.ensurePermission()}
            />
          ) : (
            <label className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Listen from</span>
              <div className="flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-fg">
                <Monitor className="size-4 text-fg-subtle" />
                This Chrome tab
              </div>
            </label>
          )}
          <DeviceField id="audio-output" label="Play through" value={selectedOutput} options={devices.outputs} onChange={devices.setOutputId} />
        </div>
        <div className="mt-5 flex flex-col items-center gap-3 border-t border-border pt-5">
          <div className="relative">
            {live ? <span className="live-ring absolute inset-0 rounded-full border border-live" aria-hidden /> : null}
            <button
              type="button"
              className={`relative inline-flex size-16 items-center justify-center rounded-full ${live ? 'bg-live text-white' : 'bg-accent text-accent-foreground'}`}
              onClick={() => void toggleCapture()}
              aria-pressed={live}
              aria-label={live ? 'Stop' : 'Start'}
            >
              {live ? (
                <MicOff className="size-6" />
              ) : mode === 'mic' ? (
                usingDeviceMic ? <Headphones className="size-6" /> : <Mic className="size-6" />
              ) : (
                <Monitor className="size-6" />
              )}
            </button>
          </div>
          <p className="max-w-md text-center font-mono text-xs tracking-wide text-fg-subtle" aria-live="polite">
            {speech.error ?? tab.error ?? mic.error ?? status}
            {busy ? ' · working' : ''}
          </p>
          {mode === 'mic' && usingDeviceMic ? (
            <p className="max-w-sm text-center text-xs leading-relaxed text-fg-subtle">
              Chosen mics are transcribed in short slices. Live captions stay on Browser microphone.
            </p>
          ) : null}
          {mode === 'meeting' ? (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,.webm,.wav,.mp3,.m4a,.ogg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void tab.sendFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs text-fg"
              >
                <Upload className="size-3.5" /> Or transcribe a clip
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="mt-4 grid flex-1 gap-4 md:grid-cols-2">
        <article className="flex min-h-[240px] flex-col rounded-xl border border-border bg-elevated p-5">
          <h2 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{source.native}</h2>
          <div ref={scrollRef} className="mt-3 flex-1 space-y-3 overflow-y-auto text-[15px] leading-relaxed">
            {lines.length === 0 && !speech.interim ? (
              <p className="text-fg-subtle">Heard speech lands here.</p>
            ) : (
              <>
                {lines.map((line) => (
                  <p key={line.id}>{line.source}</p>
                ))}
                {speech.interim ? <p className="text-fg-muted italic">{speech.interim}</p> : null}
              </>
            )}
          </div>
        </article>
        <article className="flex min-h-[240px] flex-col rounded-xl border border-border bg-elevated p-5">
          <h2 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{target.native}</h2>
          <div className="mt-3 flex-1 space-y-3 overflow-y-auto text-[15px] leading-relaxed">
            {lines.length === 0 ? (
              <p className="text-fg-subtle">Translation appears line by line.</p>
            ) : (
              lines.map((line) => (
                <div key={line.id} className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1">{line.target}</p>
                  <button
                    type="button"
                    className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-fg-subtle hover:bg-surface hover:text-fg ${speakingId === line.id ? 'text-sage' : ''}`}
                    onClick={() => void speakLine(line)}
                    aria-label="Play translation"
                  >
                    <Volume2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submitTyped();
        }}
      >
        <input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={`Type in ${source.native} if capture is blocked…`}
          className="h-12 min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 text-sm text-fg outline-none placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={!typed.trim() || busy}
          aria-label="Translate typed text"
          className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-5 text-accent-foreground disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>

      {historyOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-bg/70" onClick={() => setHistoryOpen(false)}>
          <aside
            className="flex h-full w-full max-w-md flex-col border-l border-border bg-elevated p-5"
            onClick={(event) => event.stopPropagation()}
            aria-label="Session history"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl">Sessions</h2>
              <IconButton onClick={() => setHistoryOpen(false)} label="Close history">
                <X className="size-4" />
              </IconButton>
            </div>
            <p className="mb-4 text-sm text-fg-muted">Clear archives the current transcript. Restore any past session.</p>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="text-sm text-fg-subtle">No archived sessions yet.</p>
              ) : (
                sessions.map((session) => (
                  <div key={session.id} className="rounded-lg border border-border bg-surface p-3">
                    <p className="text-sm leading-relaxed">{sessionPreview(session)}</p>
                    <p className="mt-1 font-mono text-[11px] text-fg-subtle">
                      {new Date(session.savedAt).toLocaleString()} · {session.lines.length} lines
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => restoreSession(session)}
                        className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs text-fg"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSession(session.id)}
                        className="inline-flex h-8 items-center rounded-md px-3 text-xs text-fg-muted hover:text-fg"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

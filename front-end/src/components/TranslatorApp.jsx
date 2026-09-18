import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Copy, Mic, MicOff, RotateCcw, Send } from 'lucide-react';
import { LANGUAGES, languageById } from '../lib/languages';
import { translateText } from '../lib/api';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

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

function IconButton({ onClick, label, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex size-11 items-center justify-center rounded-md text-fg-muted hover:bg-surface hover:text-fg disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export default function TranslatorApp() {
  const [sourceId, setSourceId] = useState('vi');
  const [targetId, setTargetId] = useState('en');
  const [typed, setTyped] = useState('');
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Choose a language, then hold the floor.');
  const source = languageById(sourceId);
  const target = languageById(targetId);
  const speech = useSpeechRecognition(source.speech);
  const translatingRef = useRef(false);
  const queueRef = useRef([]);
  const scrollRef = useRef(null);

  const swap = () => {
    setSourceId(targetId);
    setTargetId(sourceId);
  };

  const pushLine = useCallback(
    async (text) => {
      queueRef.current.push(text);
      if (translatingRef.current) return;
      translatingRef.current = true;
      setBusy(true);
      while (queueRef.current.length) {
        const next = queueRef.current.shift();
        setStatus('Translating…');
        const result = await translateText({
          text: next,
          source: source.translate,
          target: target.translate,
        });
        if (result.ok) {
          setLines((prev) => [...prev, { id: crypto.randomUUID(), source: next, target: result.translated }]);
          setStatus(speech.listening ? 'Listening' : 'Ready');
        } else {
          setStatus(result.error);
        }
      }
      translatingRef.current = false;
      setBusy(false);
    },
    [source.translate, target.translate, speech.listening],
  );

  useEffect(() => {
    speech.setOnFinal((text) => {
      void pushLine(text);
    });
  }, [speech, pushLine]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines, speech.interim]);

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop();
      setStatus('Paused');
      return;
    }
    speech.start();
    setStatus('Listening');
  };

  const submitTyped = async () => {
    const text = typed.trim();
    if (!text) return;
    setTyped('');
    await pushLine(text);
  };

  const copyAll = async () => {
    const blob = lines.map((line) => `${line.source}\n${line.target}`).join('\n\n');
    if (!blob) return;
    await navigator.clipboard.writeText(blob);
    setStatus('Copied');
  };

  const reset = () => {
    speech.stop();
    setLines([]);
    setTyped('');
    setStatus('Cleared');
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-[11px] tracking-[0.22em] text-sage uppercase">Part 1 · Voice loop</p>
          <h1 className="font-display text-4xl leading-none tracking-tight text-fg sm:text-5xl">Lời</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-fg-muted">
            Speak in one language. The other side writes itself — sentence by sentence.
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <IconButton onClick={copyAll} label="Copy transcript" disabled={!lines.length}>
            <Copy className="size-4" />
          </IconButton>
          <IconButton onClick={reset} label="Clear">
            <RotateCcw className="size-4" />
          </IconButton>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-elevated p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <LanguageField id="source-lang" label="Speak" value={sourceId} exclude={targetId} onChange={setSourceId} />
          <button
            type="button"
            className="mx-auto inline-flex size-11 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface hover:text-fg sm:mb-0.5"
            onClick={swap}
            aria-label="Swap languages"
          >
            <ArrowLeftRight className="size-4" />
          </button>
          <LanguageField id="target-lang" label="Hear as" value={targetId} exclude={sourceId} onChange={setTargetId} />
        </div>

        <div className="mt-5 flex flex-col items-center gap-3 border-t border-border pt-5">
          <div className="relative">
            {speech.listening ? (
              <span className="live-ring absolute inset-0 rounded-full border border-live" aria-hidden />
            ) : null}
            <button
              type="button"
              className={`relative inline-flex size-16 items-center justify-center rounded-full ${
                speech.listening ? 'bg-live text-white' : 'bg-accent text-accent-foreground'
              }`}
              onClick={toggleMic}
              aria-pressed={speech.listening}
              aria-label={speech.listening ? 'Stop listening' : 'Start listening'}
            >
              {speech.listening ? <MicOff className="size-6" /> : <Mic className="size-6" />}
            </button>
          </div>
          <p className="font-mono text-xs tracking-wide text-fg-subtle" aria-live="polite">
            {speech.error ?? status}
            {busy ? ' · working' : ''}
          </p>
        </div>
      </section>

      <div className="mt-4 grid flex-1 gap-4 md:grid-cols-2">
        <article className="flex min-h-[240px] flex-col rounded-xl border border-border bg-elevated p-5">
          <h2 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{source.native}</h2>
          <div ref={scrollRef} className="mt-3 flex-1 space-y-3 overflow-y-auto text-[15px] leading-relaxed">
            {lines.length === 0 && !speech.interim ? (
              <p className="text-fg-subtle">Your words land here first.</p>
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
              <p className="text-fg-subtle">Translation appears sentence by sentence.</p>
            ) : (
              lines.map((line) => <p key={line.id}>{line.target}</p>)
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
          placeholder={`Type in ${source.native} if the mic is busy…`}
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
    </div>
  );
}

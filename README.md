# Lời — Real-Time Speech Translator

Speak, type, or share a meeting tab. The other side writes itself, line by line.

- **Part 1:** microphone / typed text → Web Speech API → FastAPI → translation
- **Part 2:** tab / system audio → MediaRecorder chunks → STT → translation
- **Part 3:** restore punctuation + capitalization on each line
- **Part 4:** hear the translation (xAI TTS, browser speech fallback)
- **Part 5:** keep the session — autosave, history, restore, download
- **Devices:** pick a headset / USB mic to listen from, and speakers / headphones to play through

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4, Web Speech API, getUserMedia, getDisplayMedia, speechSynthesis
- **Backend:** FastAPI. Translate via Grok when `XAI_API_KEY` is set (Google gtx / MyMemory fallback). Meeting / device-mic STT via the same key or optional Whisper. Punctuate / TTS via xAI when the key is set.

## Run locally (VS Code)

Need: Python 3.10+, Node 18+, Chrome or Edge, Git. ffmpeg if you use Whisper.

```bash
git clone https://github.com/TuanNA003/real-time-translator.git
cd real-time-translator
git pull
```

### Terminal 1 — backend

```bash
cd back-end
python -m venv venv
# Windows: venv\Scripts\activate
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

Open http://localhost:8000/docs

Optional, for meeting STT + nicer punctuation + neural TTS:

- Set environment variable `XAI_API_KEY`, or
- `pip install openai-whisper` (downloads the base model on first use)

Without the key, punctuation falls back to capitalize + period, and playback uses the browser voice.

### Terminal 2 — frontend

```bash
cd front-end
npm install
npm run dev
```

Chrome: http://localhost:5173 — keep both terminals running.

## What to test

1. **Listen from:** Browser microphone (live captions) or a named headset / USB mic.
2. **Play through:** system default, speakers, or headphones — then press the speaker on a translation.
3. Mic: Start, speak a sentence. The source line should come back punctuated.
4. Type a line without punctuation (`hello how are you`) and send — status should mention Grok when the key is set.
5. Meeting tab: Start, pick a Chrome tab, enable Share tab audio (this is how you caption *speakers* / a call).
6. Clip: in Meeting mode, *Or transcribe a clip*.
7. Clear — the session lands in History. Restore it. Download `.txt`.

Default languages for meetings: English heard to Vietnamese written (swap anytime).

## Notes

- Browsers cannot capture the speakers themselves as a microphone. Use **Meeting tab** (share tab audio) or an OS loopback device that appears in **Listen from**.
- A chosen hardware mic is transcribed in ~3s slices. Live captions stay on *Browser microphone*.
- Tab capture needs Chrome and a tick on share-audio.
- Sessions live in `localStorage` on this browser only (no accounts).

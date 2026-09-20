# Transly — Real-Time Speech Translator

Speak, type, or share a meeting tab. The other side writes itself, line by line.

- **Part 1:** microphone / typed text → Web Speech API → FastAPI → translation
- **Part 2:** tab / system audio → MediaRecorder chunks → STT → translation
- **Part 3:** restore punctuation + capitalization on each line
- **Part 4:** hear the translation (xAI TTS, browser speech fallback)
- **Part 5:** keep the session — autosave, history, restore, download
- **Devices:** Listen from / Play through list connected mics, headsets, and speakers. Default is `Default (current device name)`
- **Translator:** Grok or Google from a compact picker under the target language. ChatGPT and Gemini show as Pro (locked)
- **Account:** user icon, Sign in with Google

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4, Web Speech API, getUserMedia, getDisplayMedia, speechSynthesis
- **Backend:** FastAPI. Translate via the chosen engine: Grok when `XAI_API_KEY` is set, or Google gtx / MyMemory. Meeting / device-mic STT via the same key or optional Whisper. Punctuate / TTS via xAI when the key is set.

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

1. **Listen from:** `Default (current device)` or a named headset / USB mic. Allow the microphone so device names appear.
2. **Play through:** Default, speakers, or headphones — then press the speaker on a translation.
3. **Translate with:** Grok (natural) or Google (fast). ChatGPT / Gemini stay Pro-locked.
4. Mic: Start, speak a sentence. The source line should come back punctuated.
5. Type a line without punctuation (`hello how are you`) and send — status should mention Grok or Google.
6. Meeting tab: Start, pick a Chrome tab, enable Share tab audio (this is how you caption *speakers* / a call).
7. Clip: in Meeting mode, *Or transcribe a clip*.
8. Clear — the session lands in History. Restore it. Download `.txt`.
9. Top-right user icon: Sign in with Google.

Default languages for meetings: English heard to Vietnamese written (swap anytime).

## Notes

- Browsers cannot capture the speakers themselves as a microphone. Use **Meeting tab** (share tab audio) or an OS loopback device that appears in **Listen from**.
- A chosen hardware mic is transcribed in ~3s slices. Live captions stay on **Default**.
- Tab capture needs Chrome and a tick on share-audio.
- Sessions live in `localStorage` on this browser.
- ChatGPT and Gemini are listed for the Pro demo only; they do not call those APIs yet.

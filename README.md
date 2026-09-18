# Lời — Real-Time Speech Translator

Speak, type, or share a meeting tab. The other side writes itself, line by line.

- **Part 1:** microphone / typed text → Web Speech API → FastAPI → translation
- **Part 2:** tab / system audio → MediaRecorder chunks → STT → translation

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4, Web Speech API, getDisplayMedia
- **Backend:** FastAPI. Translate via Google gtx (MyMemory fallback). Meeting STT via XAI_API_KEY or optional Whisper.

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

Meeting audio STT (pick one):

- Set environment variable XAI_API_KEY (Grok Speech-to-Text), or
- pip install openai-whisper (downloads the base model on first use)

### Terminal 2 — frontend

```bash
cd front-end
npm install
npm run dev
```

Chrome: http://localhost:5173 — keep both terminals running.

## What to test

1. Mic: Start, speak a sentence.
2. Type a line and send.
3. Meeting tab: choose Meeting tab, Start, pick a Chrome tab, enable Share tab audio. Chunks (~4s) are transcribed and translated.
4. Clip: in Meeting mode, Or transcribe a clip — upload wav/mp3/webm if share is blocked.

Default languages for meetings: English heard to Vietnamese written (swap anytime).

## Notes

- Tab capture needs Chrome and a tick on share-audio. The in-chat preview often blocks this picker; VS Code + Chrome is the real test.
- Web Speech API is mic-only. Meeting audio cannot use it — that is why Part 2 sends audio to the backend.

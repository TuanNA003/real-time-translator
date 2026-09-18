# Lời — Real-Time Speech Translator

Speak (or type) in one language. The other side writes itself, sentence by sentence.

Part 1 of the thesis: **microphone / typed text → Web Speech API → FastAPI → translation**.

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4, Web Speech API
- **Backend:** FastAPI + Google Translate (unofficial `gtx` endpoint, MyMemory fallback)

## Run locally (VS Code)

Need: Python 3.10+, Node 18+, **Chrome or Edge**, Git.

```bash
git clone https://github.com/TuanNA003/real-time-translator.git
cd real-time-translator
```

### Terminal 1 — backend

```bash
cd back-end
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

Open [http://localhost:8000/docs](http://localhost:8000/docs) — Swagger means the API is up.

### Terminal 2 — frontend

```bash
cd front-end
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in Chrome. Allow the microphone, or type a sentence in the box at the bottom.

Vite proxies `/api` to the backend, so keep **both** terminals running.

## What to test

1. Default is Vietnamese → English. Type `Xin chào` and send.
2. Start the mic, speak a full sentence, wait for the final transcript + translation.
3. Swap languages. Copy / clear.

## Notes

- Web Speech API works best in Chrome/Edge on `localhost`.
- Translation uses an unofficial Google endpoint (fine for a prototype; not for production SLA).
- System-audio / meeting capture is **Part 2** (not in this commit).

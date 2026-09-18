import asyncio
import base64
import os
import tempfile
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Lời — Real-Time Translator API",
    description="Part 1: translate. Part 2: transcribe meeting audio, then translate.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

NAME_TO_CODE = {
    "vietnamese": "vi",
    "english": "en",
    "japanese": "ja",
    "korean": "ko",
    "chinese": "zh-CN",
    "chinese (simplified)": "zh-CN",
    "chinese (traditional)": "zh-TW",
    "thai": "th",
    "indonesian": "id",
    "french": "fr",
    "german": "de",
    "spanish": "es",
    "tiếng việt": "vi",
}

_whisper_model = None


def to_code(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return "auto"
    key = raw.lower()
    if key in NAME_TO_CODE:
        return NAME_TO_CODE[key]
    if len(raw) <= 8 and raw.replace("-", "").isalpha():
        return raw
    return raw[:2].lower()


def lang_short(value: str) -> str:
    code = to_code(value)
    if code in {"auto", ""}:
        return "en"
    return code.split("-")[0]


def extension_for(mime: str) -> str:
    mime = (mime or "").lower()
    if "wav" in mime:
        return "wav"
    if "mpeg" in mime or "mp3" in mime:
        return "mp3"
    if "ogg" in mime:
        return "ogg"
    if "mp4" in mime or "m4a" in mime:
        return "m4a"
    if "flac" in mime:
        return "flac"
    return "webm"


class TranslationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    source: Optional[str] = None
    target: Optional[str] = None


class AudioRequest(BaseModel):
    audio_data: str = Field(..., min_length=8, max_length=3_500_000)
    mime: Optional[str] = None
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    source: Optional[str] = None
    target: Optional[str] = None


def parse_google_payload(data: object) -> str:
    if not isinstance(data, list) or not data or not isinstance(data[0], list):
        return ""
    parts = []
    for item in data[0]:
        if isinstance(item, list) and item and isinstance(item[0], str):
            parts.append(item[0])
    return "".join(parts).strip()


async def google_translate(text: str, source: str, target: str) -> str:
    url = "https://translate.googleapis.com/translate_a/single"
    params = {"client": "gtx", "sl": source, "tl": target, "dt": "t", "q": text}
    async with httpx.AsyncClient(timeout=12.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        out = parse_google_payload(response.json())
        if not out:
            raise ValueError("Empty translation")
        return out


async def mymemory_translate(text: str, source: str, target: str) -> str:
    sl = source.split("-")[0]
    tl = target.split("-")[0]
    url = "https://api.mymemory.translated.net/get"
    params = {"q": text, "langpair": f"{sl}|{tl}"}
    async with httpx.AsyncClient(timeout=12.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()
        out = (payload.get("responseData") or {}).get("translatedText") or ""
        out = str(out).strip()
        if not out:
            raise ValueError("Empty fallback translation")
        return out


async def translate_plain(text: str, source: str, target: str) -> str:
    if source.lower() == target.lower():
        return text
    try:
        return await google_translate(text, source, target)
    except Exception:
        return await mymemory_translate(text, source, target)


def stt_backend() -> str:
    if os.environ.get("XAI_API_KEY"):
        return "xai"
    try:
        import whisper  # noqa: F401

        return "whisper"
    except Exception:
        return "unavailable"


async def transcribe_xai(audio: bytes, mime: str, language: str) -> str:
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        raise RuntimeError("missing XAI_API_KEY")
    filename = f"clip.{extension_for(mime)}"
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(
            "https://api.x.ai/v1/stt",
            headers={"Authorization": f"Bearer {api_key}"},
            data={
                "model": "grok-voice-transcribe-1.0",
                "language": language,
                "format": "true",
            },
            files={"file": (filename, audio, mime or "application/octet-stream")},
        )
        response.raise_for_status()
        payload = response.json()
        return str(payload.get("text") or "").strip()


def _whisper_transcribe_sync(audio: bytes, mime: str, language: str) -> str:
    global _whisper_model
    try:
        import whisper
    except ImportError as exc:
        raise RuntimeError("Install openai-whisper or set XAI_API_KEY") from exc
    if _whisper_model is None:
        _whisper_model = whisper.load_model("base")
    suffix = f".{extension_for(mime)}"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(audio)
        tmp.flush()
        result = _whisper_model.transcribe(tmp.name, language=language)
    return str(result.get("text") or "").strip()


async def transcribe_audio(audio: bytes, mime: str, language: str) -> str:
    if os.environ.get("XAI_API_KEY"):
        return await transcribe_xai(audio, mime, language)
    return await asyncio.to_thread(_whisper_transcribe_sync, audio, mime, language)


@app.get("/health")
def health():
    return {"status": "ok", "stt": stt_backend()}


@app.post("/api/translate")
async def translate_text(request: TranslationRequest):
    text = request.text.strip()
    if not text:
        return {"ok": True, "translated_text": ""}

    source = to_code(request.source_language or request.source or "auto")
    target = to_code(request.target_language or request.target or "en")
    try:
        translated = await translate_plain(text, source, target)
        return {"ok": True, "translated_text": translated}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Translation failed: {exc}") from exc


@app.post("/api/transcribe-and-translate")
async def transcribe_and_translate(request: AudioRequest):
    if stt_backend() == "unavailable":
        raise HTTPException(
            status_code=503,
            detail="Meeting STT needs XAI_API_KEY or: pip install openai-whisper",
        )
    try:
        audio = base64.b64decode(request.audio_data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid audio data") from exc
    if len(audio) < 1500:
        return {"ok": True, "transcribed_text": "", "translated_text": ""}

    source = lang_short(request.source_language or request.source or "en")
    target = to_code(request.target_language or request.target or "vi")
    mime = request.mime or "audio/wav"
    try:
        transcribed = await transcribe_audio(audio, mime, source)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {exc}") from exc

    if not transcribed:
        return {"ok": True, "transcribed_text": "", "translated_text": ""}

    try:
        translated = await translate_plain(transcribed, source, target)
        return {"ok": True, "transcribed_text": transcribed, "translated_text": translated}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Translation failed: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

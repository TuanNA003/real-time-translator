from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Lời — Real-Time Translator API",
    description="Translate short utterances. Part 1 of the speech-to-text thesis.",
    version="1.0.0",
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


class TranslationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/translate")
async def translate_text(request: TranslationRequest):
    text = request.text.strip()
    if not text:
        return {"ok": True, "translated_text": ""}

    source = to_code(request.source_language or request.source or "auto")
    target = to_code(request.target_language or request.target or "en")
    if source.lower() == target.lower():
        return {"ok": True, "translated_text": text}

    try:
        translated = await google_translate(text, source, target)
        return {"ok": True, "translated_text": translated}
    except Exception:
        try:
            translated = await mymemory_translate(text, source, target)
            return {"ok": True, "translated_text": translated}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Translation failed: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

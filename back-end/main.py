import os
import base64
import tempfile
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
from deepmultilingualpunctuation import PunctuationModel
import whisper
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import httpx
# from googletrans import Translator

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

app = FastAPI(
    title="Real-Time Speech Translator API (NLLB + Punctuation)",
    description="An API to restore punctuation and translate text using high-quality Hugging Face models.",
    version="4.0.0",
)

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "chrome-extension://*",
    "moz-extension://*",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

class TranslationRequest(BaseModel):
    text: str
    source_language: str
    target_language: str

class AudioTranscriptionRequest(BaseModel):
    audio_data: str
    source_language: str
    target_language: str

model_cache = {}

async def google_translate(text: str, source_lang_name: str, target_lang_name: str):
    if not text or not text.strip():
        return text
    
    # Mapping tên ngôn ngữ sang code
    lang_map = {
        'English': 'en',
        'Vietnamese': 'vi',
        'German': 'de',
        'French': 'fr',
        'Spanish': 'es',
        'Chinese (Simplified)': 'zh-cn',
        'Chinese (Traditional)': 'zh-tw',
        'Chinese (Mandarin)': 'zh-cn',
        'Japanese': 'ja',
        'Korean': 'ko',
        'Russian': 'ru',
        'Arabic': 'ar',
        'Thai': 'th',
        'Indonesian': 'id',
        'Portuguese': 'pt',
        'Italian': 'it',
        'Dutch': 'nl',
        'Turkish': 'tr',
        'Polish': 'pl',
        'Swedish': 'sv',
        'Norwegian': 'no',
        'Danish': 'da',
        'Finnish': 'fi',
        'Greek': 'el',
        'Hebrew': 'he',
        'Hindi': 'hi',
        'Malay': 'ms',
        'Filipino': 'tl',      # Tagalog
        'Tagalog': 'tl',
        'Czech': 'cs',
        'Hungarian': 'hu',
        'Romanian': 'ro',
        'Ukrainian': 'uk',
        'Bulgarian': 'bg',
        'Croatian': 'hr',
        'Slovak': 'sk',
        'Slovenian': 'sl',
        'Persian': 'fa',
        'Urdu': 'ur',
        'Bengali': 'bn',
        'Tamil': 'ta',
        'Telugu': 'te',
        'Marathi': 'mr',
        'Gujarati': 'gu',
        'Kannada': 'kn',
        'Malayalam': 'ml',
        'Punjabi': 'pa',
        'Nepali': 'ne',
        'Sinhala': 'si',
        'Khmer': 'km',
        'Lao': 'lo',
        'Burmese': 'my',
        'Amharic': 'am',
        'Swahili': 'sw',
        'Hausa': 'ha',
        'Yoruba': 'yo',
        'Igbo': 'ig',
    }
    
    source_code = lang_map.get(source_lang_name, source_lang_name[:2].lower())
    target_code = lang_map.get(target_lang_name, target_lang_name[:2].lower())
    
    url = "https://translate.googleapis.com/translate_a/single"
    
    params = {
        "client": "gtx",
        "sl": source_code,
        "tl": target_code,
        "dt": "t",
        "q": text
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            translated = ''.join([item[0] for item in data[0] if item and isinstance(item[0], str)])
            return translated
    except Exception as e:
        print(f"Google Translate API error: {e}")
        raise

google_translator = None

def get_google_translator():
    global google_translator
    if google_translator is None:
        google_translator = Translator()
        print("✅ Google Translator initialized")
    return google_translator

punctuation_model_cache = None

# ==================== GOOGLE TRANSLATE LANGUAGE MAPPING ====================
google_language_codes = {
    'English': 'en',
    'Vietnamese': 'vi',
    'German': 'de',
    'French': 'fr',
    'Spanish': 'es',
    'Chinese (Simplified)': 'zh-cn',
    'Chinese (Traditional)': 'zh-tw',
    'Chinese (Mandarin)': 'zh-cn',
    'Japanese': 'ja',
    'Korean': 'ko',
    'Russian': 'ru',
    'Arabic': 'ar',
    'Thai': 'th',
    'Indonesian': 'id',
    'Portuguese': 'pt',
    'Italian': 'it',
    'Dutch': 'nl',
    'Turkish': 'tr',
    'Polish': 'pl',
    'Swedish': 'sv',
    'Norwegian': 'no',
    'Danish': 'da',
    'Finnish': 'fi',
    'Greek': 'el',
    'Hebrew': 'he',
    'Hindi': 'hi',
    'Malay': 'ms',
    'Filipino': 'tl',      # Tagalog
    'Tagalog': 'tl',
    'Czech': 'cs',
    'Hungarian': 'hu',
    'Romanian': 'ro',
    'Ukrainian': 'uk',
    'Bulgarian': 'bg',
    'Croatian': 'hr',
    'Slovak': 'sk',
    'Slovenian': 'sl',
    'Persian': 'fa',
    'Urdu': 'ur',
    'Bengali': 'bn',
    'Tamil': 'ta',
    'Telugu': 'te',
    'Marathi': 'mr',
    'Gujarati': 'gu',
    'Kannada': 'kn',
    'Malayalam': 'ml',
    'Punjabi': 'pa',
    'Nepali': 'ne',
    'Sinhala': 'si',
    'Khmer': 'km',
    'Lao': 'lo',
    'Burmese': 'my',
    'Amharic': 'am',
    'Swahili': 'sw',
    'Hausa': 'ha',
    'Yoruba': 'yo',
    'Igbo': 'ig',
    # Thêm các ngôn ngữ khác nếu cần
}

# Fallback nếu không tìm thấy
def get_google_lang_code(lang_name: str) -> str:
    """Lấy code Google Translate từ tên ngôn ngữ"""
    code = google_language_codes.get(lang_name)
    if code:
        return code
    # Fallback: lấy 2 ký tự đầu
    return lang_name[:2].lower()

def get_punctuation_model():
    global punctuation_model_cache
    if punctuation_model_cache is None:
        try:
            print("Loading punctuation model...")
            punctuation_model_cache = PunctuationModel()
            print("Punctuation model loaded successfully.")
        except Exception as e:
            print(f"Failed to load punctuation model: {e}")
            punctuation_model_cache = None
    return punctuation_model_cache

def get_whisper_model():
    model_name = "whisper"
    if model_name in model_cache:
        return model_cache[model_name]
    
    try:
        print("Loading Whisper model...")
        whisper_model = whisper.load_model("base")
        model_cache[model_name] = whisper_model
        print("Whisper model loaded successfully.")
        return whisper_model
    except Exception as e:
        print(f"Failed to load Whisper model: {e}")
        return None

# ====================== API ENDPOINTS ======================

@app.post("/api/translate", tags=["Translation"])
async def translate_text(request: TranslationRequest):
    try:
        if not request.text or not request.text.strip():
            return {"translated_text": ""}

        punctuation_model = get_punctuation_model()
        punctuated_text = punctuation_model.restore_punctuation(request.text) if punctuation_model else request.text

        translated_text = await google_translate(
            punctuated_text,
            request.source_language,
            request.target_language
        )

        return {"translated_text": translated_text}

    except Exception as e:
        print(f"Translation error: {e}")
        raise HTTPException(status_code=500, detail="Translation failed")
    

@app.post("/api/transcribe-and-translate", tags=["Audio Processing"])
async def transcribe_and_translate(request: AudioTranscriptionRequest):
    try:
        audio_bytes = base64.b64decode(request.audio_data)
        
        whisper_model = get_whisper_model()
        if not whisper_model:
            raise HTTPException(status_code=500, detail="Whisper model not available")

        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_audio_path = temp_audio.name

        try:
            result = whisper_model.transcribe(temp_audio_path)
            transcribed_text = result["text"].strip()

            if not transcribed_text:
                return {
                    "transcribed_text": "", 
                    "translated_text": "",
                    "detected_language": result.get("language", "unknown")
                }

            # Punctuation
            punctuation_model = get_punctuation_model()
            punctuated_text = punctuation_model.restore_punctuation(transcribed_text) if punctuation_model else transcribed_text

            # Translate
            source_code = nllb_language_codes.get(request.source_language)
            target_code = nllb_language_codes.get(request.target_language)
            if not source_code or not target_code:
                raise ValueError("Unsupported language specified.")

            translator_dict = get_nllb_translator(source_code, target_code)
            model = translator_dict["model"]
            tokenizer = translator_dict["tokenizer"]

            inputs = tokenizer(punctuated_text, return_tensors="pt", padding=True, truncation=True, max_length=512).to(device)

            with torch.no_grad():
                generated_tokens = model.generate(
                    **inputs,
                    forced_bos_token_id=tokenizer.convert_tokens_to_ids(target_code),
                    max_length=512,
                    max_new_tokens=256,
                    num_beams=4,
                    early_stopping=True,
                    no_repeat_ngram_size=3
                )

            translated_text = tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)[0].strip()

            return {
                "transcribed_text": punctuated_text,
                "translated_text": translated_text,
                "detected_language": result.get("language", "unknown")
            }

        finally:
            os.unlink(temp_audio_path)

    except Exception as e:
        print(f"Audio processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process audio: {str(e)}")

# Startup
@app.on_event("startup")
async def startup_event():
    """Load models and initialize services when the server starts"""
    print("Server starting up...")
    get_punctuation_model()
    print("Server startup complete! Ready to translate.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
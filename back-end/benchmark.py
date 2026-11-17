"""Compare translation engines on speed and a simple character score.

Run from the back-end folder, after keys are set (UI or environment):

    python benchmark.py

Engines without a key are skipped, not counted as failures of another engine.
"""

import asyncio
import time
from difflib import SequenceMatcher

from main import get_key, translate_plain

CASES = [
    {
        "id": "mic-echo",
        "source": "en",
        "target": "vi",
        "text": "Could you turn the microphone down a little? The echo is making it hard to hear.",
        "reference": "Bạn có thể vặn nhỏ micro một chút được không? Tiếng vọng làm khó nghe quá.",
    },
    {
        "id": "late-seat",
        "source": "en",
        "target": "vi",
        "text": "I'll be five minutes late — save me a seat near the window.",
        "reference": "Tôi sẽ trễ năm phút — giữ giúp tôi chỗ gần cửa sổ.",
    },
    {
        "id": "moved-meeting",
        "source": "vi",
        "target": "en",
        "text": "Cuộc họp bị dời sang thứ Sáu vì sếp đang đi công tác.",
        "reference": "The meeting was moved to Friday because the boss is on a business trip.",
    },
    {
        "id": "natural-tone",
        "source": "vi",
        "target": "en",
        "text": "Đừng dịch sát từng chữ, hãy giữ giọng nói tự nhiên.",
        "reference": "Don't translate word for word — keep the tone natural.",
    },
    {
        "id": "invoice",
        "source": "en",
        "target": "ja",
        "text": "Please send the invoice before Friday.",
        "reference": "金曜日までに請求書を送ってください。",
    },
    {
        "id": "idiom",
        "source": "en",
        "target": "vi",
        "text": "Let's not beat around the bush.",
        "reference": "Nói thẳng ra đi, đừng vòng vo.",
    },
]


def available_engines() -> list[str]:
    engines = ["google"]
    if get_key("XAI_API_KEY"):
        engines.insert(0, "grok")
    if get_key("OPENAI_API_KEY"):
        engines.append("chatgpt")
    if get_key("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        engines.append("gemini")
    return engines


def char_score(hypothesis: str, reference: str) -> float:
    left = "".join(hypothesis.lower().split())
    right = "".join(reference.lower().split())
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


async def run_case(engine: str, case: dict) -> dict:
    started = time.perf_counter()
    try:
        text, used = await translate_plain(case["text"], case["source"], case["target"], engine)
        elapsed = time.perf_counter() - started
        return {
            "ok": True,
            "engine": used,
            "seconds": elapsed,
            "score": char_score(text, case["reference"]),
            "text": text,
        }
    except Exception as exc:
        return {
            "ok": False,
            "engine": engine,
            "seconds": time.perf_counter() - started,
            "score": 0.0,
            "text": str(exc),
        }


async def main() -> None:
    engines = available_engines()
    print("Engines:", ", ".join(engines))
    print("Missing keys are skipped. Set them in the app or as environment variables.\n")
    totals = {engine: {"seconds": 0.0, "score": 0.0, "ok": 0} for engine in engines}

    for case in CASES:
        print(f"[{case['id']}] {case['source']} → {case['target']}")
        print(f"  src: {case['text']}")
        print(f"  ref: {case['reference']}")
        for engine in engines:
            result = await run_case(engine, case)
            if result["ok"]:
                totals[engine]["seconds"] += result["seconds"]
                totals[engine]["score"] += result["score"]
                totals[engine]["ok"] += 1
                print(f"  {engine:8} {result['seconds']:5.2f}s  score {result['score']:.2f}  {result['text']}")
            else:
                print(f"  {engine:8} FAIL  {result['text']}")
        print()

    print("Summary (successful cases only)")
    print(f"{'engine':8} {'avg s':>8} {'avg score':>10} {'ok':>4}")
    for engine in engines:
        row = totals[engine]
        if not row["ok"]:
            print(f"{engine:8} {'—':>8} {'—':>10} {0:4}")
            continue
        print(f"{engine:8} {row['seconds'] / row['ok']:8.2f} {row['score'] / row['ok']:10.2f} {row['ok']:4}")
    print("\nScore is character similarity against one reference, not BLEU.")
    print("A lower score can still be a good paraphrase. Read the lines above.")


if __name__ == "__main__":
    asyncio.run(main())

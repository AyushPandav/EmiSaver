import re
from typing import Tuple

try:
    from langdetect import detect
except ImportError:
    detect = None

HINGLISH_WORDS = {
    "kare", "karein", "deve", "bhare", "chukaen", "bhi", "aaj", "kal", "din",
    "mahina", "rupaye", "jama", "khata", "bachat", "rin", "byaj", "shulk",
    "kist", "agla", "tarikh", "sampark", "kripya", "dhanyawad", "antim"
}

MARATHI_WORDS = {
    "आहे", "करावे", "हप्ता", "दिनांक", "भरणा", "कर्ज", "शिल्लक", "पावती", "रुपये"
}


def detect_language(text: str) -> Tuple[str, float]:
    """
    Detects language of message using Unicode script ranges and keyword heuristics (§4.5):
    - Tamil (\u0B80-\u0BFF) -> 'ta'
    - Telugu (\u0C00-\u0C7F) -> 'te'
    - Bengali (\u0980-\u09FF) -> 'bn'
    - Devanagari (\u0900-\u097F) -> 'hi' or 'mr'
    - Hinglish (Latin script with Hindi loan words)
    - English ('en')
    Returns: (lang_code, detection_confidence)
    """
    if not text:
        return "en", 0.50

    # 1. Tamil Script (\u0B80 to \u0BFF)
    tamil_chars = len(re.findall(r'[\u0B80-\u0BFF]', text))
    if tamil_chars >= 4:
        return "ta", 0.92

    # 2. Telugu Script (\u0C00 to \u0C7F)
    telugu_chars = len(re.findall(r'[\u0C00-\u0C7F]', text))
    if telugu_chars >= 4:
        return "te", 0.92

    # 3. Bengali Script (\u0980 to \u09FF)
    bengali_chars = len(re.findall(r'[\u0980-\u09FF]', text))
    if bengali_chars >= 4:
        return "bn", 0.92

    # 4. Devanagari Script (\u0900 to \u097F) -> Hindi or Marathi
    devanagari_chars = len(re.findall(r'[\u0900-\u097F]', text))
    if devanagari_chars >= 4:
        # Check for Marathi specific vocabulary
        words = set(text.split())
        if len(words.intersection(MARATHI_WORDS)) >= 1:
            return "mr", 0.90
        return "hi", 0.95

    # 5. Hinglish in Latin Script
    tokens = set(re.findall(r'[a-zA-Z]+', text.lower()))
    hinglish_matches = tokens.intersection(HINGLISH_WORDS)
    if len(hinglish_matches) >= 2:
        return "hinglish", 0.90

    # 6. Fallback to langdetect if available
    if detect:
        try:
            detected = detect(text)
            if detected in ["hi", "en", "mr", "gu", "bn", "ta", "te", "kn", "ml"]:
                return detected, 0.85
        except Exception:
            pass

    return "en", 0.90

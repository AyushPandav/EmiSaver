import re
from datetime import date, datetime, timedelta
from typing import Optional, Tuple
from app.services.nlp.amount_detector import normalize_indic_digits

try:
    import dateparser
except ImportError:
    dateparser = None

# English Month Names
MONTH_NAMES = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12
}

# Multilingual Month Names (§4.5)
INDIC_MONTH_NAMES = {
    # Hindi / Marathi
    "जनवरी": 1, "फ़रवरी": 2, "फरवरी": 2, "मार्च": 3, "अप्रैल": 4, "अप्रेल": 4,
    "मई": 5, "जून": 6, "जुलाई": 7, "अगस्त": 8, "सितंबर": 9, "सितम्बर": 9,
    "अक्टूबर": 10, "अक्टोबर": 10, "नवंबर": 11, "नवम्बर": 11, "दिसंबर": 12, "दिसम्बर": 12,
    # Bengali
    "জানুয়ারি": 1, "ফেব্রুয়ারি": 2, "মার্চ": 3, "এপ্রিল": 4, "মে": 5, "জুন": 6,
    "জুলাই": 7, "আগস্ট": 8, "সেপ্টেম্বর": 9, "অক্টোবর": 10, "নভেম্বর": 11, "ডিসেম্বর": 12,
    # Tamil
    "ஜனவரி": 1, "பிப்ரவரி": 2, "மார்ச்": 3, "ஏப்ரல்": 4, "மே": 5, "ஜூன்": 6,
    "ஜூலை": 7, "ஆகஸ்ட்": 8, "செப்டம்பர்": 9, "அக்டோபர்": 10, "நவம்பர்": 11, "டிசம்பர்": 12,
    # Telugu
    "జనవరి": 1, "ఫిబ్రవరి": 2, "మార్చి": 3, "ఏప్రిల్": 4, "మే": 5, "జూన్": 6,
    "జూలై": 7, "ఆగస్టు": 8, "సెప్టెంబర్": 9, "అక్టోబర్": 10, "నవంబర్": 11, "డిసెంబర్": 12
}


def detect_date(text: str, reference_date: Optional[date] = None) -> Tuple[Optional[date], float]:
    """
    Detects due dates from message text using multilingual regex patterns,
    Indic month lookups, Indic digit normalization, and dateparser fallback.
    Returns: (parsed_date, confidence)
    """
    if not text:
        return None, 0.0

    today = reference_date or date.today()

    # Convert Indic numerals to standard 0-9 digits
    normalized_text = normalize_indic_digits(text)
    lower_text = normalized_text.lower()

    # 1. Check relative date keywords (English & Hindi)
    if re.search(r'\b(due today|by today|today|आज)\b', lower_text):
        return today, 0.95
    if re.search(r'\b(due tomorrow|by tomorrow|tomorrow|कल)\b', lower_text):
        return today + timedelta(days=1), 0.95
    m_days = re.search(r'\b(?:due in|within|में)\s*([0-9]+)\s*(?:days|दिन)\b', lower_text)
    if m_days:
        return today + timedelta(days=int(m_days.group(1))), 0.90

    # 2. English Day-Month pattern: "25 Sep", "25th September", "25 Sep 2026"
    day_month_pattern = r'\b([0-2]?[0-9]|3[01])(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*,?\s*([2][0-9]{3}))?\b'
    m_dm = re.search(day_month_pattern, lower_text)
    if m_dm:
        day = int(m_dm.group(1))
        month_str = m_dm.group(2)
        month = MONTH_NAMES.get(month_str, 1)
        year = int(m_dm.group(3)) if m_dm.group(3) else today.year
        try:
            return date(year, month, day), 0.96
        except ValueError:
            pass

    # 3. English Month-Day pattern: "Sep 25", "September 25th"
    month_day_pattern = r'\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+([0-2]?[0-9]|3[01])(?:st|nd|rd|th)?(?:\s*,?\s*([2][0-9]{3}))?\b'
    m_md = re.search(month_day_pattern, lower_text)
    if m_md:
        month = MONTH_NAMES.get(m_md.group(1), 1)
        day = int(m_md.group(2))
        year = int(m_md.group(3)) if m_md.group(3) else today.year
        try:
            return date(year, month, day), 0.95
        except ValueError:
            pass

    # 4. Multilingual Indic Month Patterns (Hindi, Bengali, Tamil, Telugu)
    # E.g. "25 सितंबर", "15 அக்டோபர்", "২০ অক্টোবর", "25 सितंबर 2026"
    indic_months_re = "|".join(re.escape(k) for k in INDIC_MONTH_NAMES.keys())
    indic_dm_pattern = rf'([0-2]?[0-9]|3[01])\s*({indic_months_re})(?:\s*([2][0-9]{{3}}))?'
    m_indic = re.search(indic_dm_pattern, normalized_text)
    if m_indic:
        day = int(m_indic.group(1))
        month_name = m_indic.group(2)
        month = INDIC_MONTH_NAMES.get(month_name, 1)
        year = int(m_indic.group(3)) if m_indic.group(3) else today.year
        try:
            return date(year, month, day), 0.94
        except ValueError:
            pass

    # Reverse order: e.g. "অক্টোবর ২০" or "सितंबर 25"
    indic_md_pattern = rf'({indic_months_re})\s*([0-2]?[0-9]|3[01])(?:\s*([2][0-9]{{3}}))?'
    m_indic_rev = re.search(indic_md_pattern, normalized_text)
    if m_indic_rev:
        month_name = m_indic_rev.group(1)
        day = int(m_indic_rev.group(2))
        month = INDIC_MONTH_NAMES.get(month_name, 1)
        year = int(m_indic_rev.group(3)) if m_indic_rev.group(3) else today.year
        try:
            return date(year, month, day), 0.94
        except ValueError:
            pass

    # 5. Standard Numeric Dates: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    dmy_pattern = r'\b([0-2]?[0-9]|3[01])[\/\-\.]([0-1]?[0-9])[\/\-\.]([2][0-9]{3})\b'
    m_dmy = re.search(dmy_pattern, normalized_text)
    if m_dmy:
        day = int(m_dmy.group(1))
        month = int(m_dmy.group(2))
        year = int(m_dmy.group(3))
        try:
            return date(year, month, day), 0.95
        except ValueError:
            pass

    # 6. Fallback: dateparser with Indian date bias
    if dateparser:
        date_snippets = re.findall(r'(?:due\s*(?:date|on|by)?|before|on|को|தேதி|তারিখ)\s*([A-Za-z0-9\s,\/\-]{3,25})', normalized_text, re.IGNORECASE)
        for snippet in date_snippets:
            parsed = dateparser.parse(
                snippet,
                settings={'PREFER_DAY_OF_MONTH': 'first', 'DATE_ORDER': 'DMY', 'RELATIVE_BASE': datetime.combine(today, datetime.min.time())}
            )
            if parsed:
                return parsed.date(), 0.85

    return None, 0.0

import unicodedata
import re


def clean_text(raw_text: str) -> str:
    """
    Cleans raw SMS / push-notification text:
    - Unicode normalization (NFKC)
    - Strips URLs and phishing warnings
    - Standardizes currency representations
    - Collapses excessive whitespace
    """
    if not raw_text:
        return ""

    # Unicode normalization
    text = unicodedata.normalize("NFKC", raw_text)

    # Standardize Rupee symbols: ₹, Rs., Rs, INR -> ₹
    text = re.sub(r'\b(inr|rs\.?|rupees?)\b\s*', '₹', text, flags=re.IGNORECASE)

    # Remove URLs (often payment links or bit.ly links)
    text = re.sub(r'https?://\S+|www\.\S+', '', text)

    # Remove common SMS footers / signatures
    text = re.sub(r'(to opt out|terms and conditions apply|t&c apply|download app).*$', '', text, flags=re.IGNORECASE)

    # Collapse multiple whitespaces
    text = re.sub(r'\s+', ' ', text).strip()

    return text

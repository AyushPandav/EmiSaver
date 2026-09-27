import re
from typing import Optional, Tuple, List

# Unicode Indic digit mapping to standard Arabic digits (0-9)
INDIC_DIGIT_MAP = {
    # Devanagari (Hindi, Marathi)
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
    # Bengali
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
    # Tamil
    '௦': '0', '௧': '1', '௨': '2', '௩': '3', '௪': '4', '௫': '5', '௬': '6', '௭': '7', '௮': '8', '௯': '9',
    # Telugu
    '౦': '0', '౧': '1', '౨': '2', '౩': '3', '౪': '4', '౫': '5', '౬': '6', '౭': '7', '౮': '8', '౯': '9'
}


def normalize_indic_digits(text: str) -> str:
    """Replaces Indic numerals (Devanagari, Bengali, Tamil, Telugu) with standard 0-9 digits."""
    return "".join(INDIC_DIGIT_MAP.get(ch, ch) for ch in text)


def parse_numeric_string(val_str: str) -> Optional[float]:
    """Converts cleaned numeric string like '15,000.50' or '2.5k' into float."""
    clean = val_str.replace(",", "").strip().lower()
    try:
        if clean.endswith("k"):
            return float(clean[:-1]) * 1000
        return float(clean)
    except ValueError:
        return None


def detect_amounts(text: str) -> Tuple[Optional[float], Optional[float], float]:
    """
    Detects loan principal amount and EMI amount from text.
    Supports English, Hindi, Marathi, Bengali, Tamil, and Telugu currency tokens and Indic numerals.
    Returns: (loan_amount, emi_amount, confidence)
    """
    if not text:
        return None, None, 0.0

    # Normalize any Indic digits (e.g. Devanagari / Bengali) to standard 0-9
    normalized_text = normalize_indic_digits(text)

    loan_amount: Optional[float] = None
    emi_amount: Optional[float] = None
    confidence = 0.0

    # Multi-lingual currency prefix regex: ₹, Rs, INR, रु, रुपये, টাকা, ரூபாய்/ரூ, రూపాయలు/రూ
    CURRENCY_PREFIX = r'(?:₹|rs\.?|inr|रु\.?|रुपये|रुपया|টাকা|ট\.?|ரூபாய்|ரூ\.?|రూపాయలు|రూ\.?)'
    
    # Amount number pattern: e.g. 15,000 or 15000 or 2500.50 or 2.5k
    NUM_PATTERN = r'([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?k?)'
    
    amt_pattern = rf'{CURRENCY_PREFIX}\s*{NUM_PATTERN}'
    amt_suffix_pattern = rf'{NUM_PATTERN}\s*{CURRENCY_PREFIX}'

    # Check for loan amount contexts (multilingual keywords included: कर्ज, ऋण, கடன், ఋణం)
    loan_contexts = [
        r'(?:loan\s*(?:amount|of)?|sanctioned|approved|disbursed|credit\s*limit\s*(?:of)?|कर्ज|ऋण|கடன்|ఋణం)\s*(?:is\s*)?' + amt_pattern,
        amt_pattern + r'\s*(?:loan|disbursed|approved|मंजूर|वितरित)',
        r'(?:loan|कर्ज|ऋण|கடன்|ఋణం)\s*(?:of|is)?\s*' + amt_suffix_pattern
    ]

    for ctx in loan_contexts:
        match = re.search(ctx, normalized_text, re.IGNORECASE)
        if match:
            val = parse_numeric_string(match.group(1))
            if val and val > 0:
                loan_amount = val
                confidence = max(confidence, 0.95)
                break

    # Check for EMI / installment / repayment contexts (multilingual: किस्त, हप्ता, কিস্তি, இஎம்ஐ, ఈఎంఐ)
    emi_contexts = [
        r'(?:emi|installment|due|repayment|payable|auto-debit|bill|min\s*due|किस्त|हप्ता|কিস্তি|இஎம்ஐ|ஈஎம்ஐ|ఈఎంఐ)\s*(?:of|is|amount|की\s*है|है|தேதி)?\s*:?\s*' + amt_pattern,
        amt_pattern + r'\s*(?:repayment|emi|installment|due|will\s*be\s*debited|auto-debit|देय|भरा|भरणा)',
        r'(?:emi|installment|किस्त|हप्ता|কিস্তি|இஎம்ஐ|ఈఎంఐ)\s*(?:is|of|की)?\s*' + amt_suffix_pattern
    ]

    for ctx in emi_contexts:
        match = re.search(ctx, normalized_text, re.IGNORECASE)
        if match:
            val = parse_numeric_string(match.group(1))
            if val and val > 0:
                emi_amount = val
                confidence = max(confidence, 0.95)
                break

    # Fallback 1: match any occurrence with currency prefix or suffix
    all_amounts: List[float] = []
    for m in re.finditer(amt_pattern, normalized_text, re.IGNORECASE):
        parsed = parse_numeric_string(m.group(1))
        if parsed and parsed > 0:
            all_amounts.append(parsed)

    for m in re.finditer(amt_suffix_pattern, normalized_text, re.IGNORECASE):
        parsed = parse_numeric_string(m.group(1))
        if parsed and parsed > 0:
            all_amounts.append(parsed)

    if not emi_amount and not loan_amount and all_amounts:
        if len(all_amounts) == 1:
            if any(w in normalized_text.lower() for w in ["approved", "sanctioned", "disbursed", "मंजूर"]):
                loan_amount = all_amounts[0]
                confidence = max(confidence, 0.80)
            else:
                emi_amount = all_amounts[0]
                confidence = max(confidence, 0.80)
        elif len(all_amounts) >= 2:
            sorted_amts = sorted(all_amounts)
            emi_amount = sorted_amts[0]
            loan_amount = sorted_amts[-1]
            confidence = max(confidence, 0.75)

    # Edge-case: if loan_amount detected but message is an EMI reminder or has "EMI"/"किस्त"/"हप्ता", assign to emi_amount
    if emi_amount is None and loan_amount is not None:
        if any(w in normalized_text.lower() for w in ["emi", "installment", "due on", "repayment due", "bill", "किस्त", "हप्ता", "देय", "কিস্তি", "இஎம்ஐ", "ఈఎంఐ"]):
            emi_amount = loan_amount
            loan_amount = None

    return loan_amount, emi_amount, (confidence if (loan_amount or emi_amount) else 0.0)

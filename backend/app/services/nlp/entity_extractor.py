import re
from typing import Optional, Tuple


def extract_loan_identifier(text: str) -> Tuple[Optional[str], float]:
    """
    Extracts masked account or loan identifier from text:
    - XXXX7841, XX7841, ...7841
    - Loan ID: LN-12345
    - Loan A/C ending 5678
    - Account No: 123456
    """
    # Pattern 1: Masked with X or *
    m_masked = re.search(r'\b([Xx*]{2,}[0-9]{3,5})\b', text)
    if m_masked:
        return m_masked.group(1).upper(), 0.95

    # Pattern 2: Explicit Loan ID / Account ID / Ref No
    m_id = re.search(r'(?:loan\s*(?:id|no\.?|acc(?:ount)?(?:\s*no\.?)?|number)|ref\s*no\.?)\s*[:#\-]?\s*([a-z0-9\-_]{4,15})', text, re.IGNORECASE)
    if m_id:
        val = m_id.group(1).strip()
        # Avoid picking up common words as IDs
        if not val.lower() in ["for", "is", "the", "due", "inr", "rs"]:
            return val.upper(), 0.90

    # Pattern 3: "ending with 1234" or "ending in 1234"
    m_ending = re.search(r'(?:ending\s*(?:with|in)?|a\/c|acc)\s*[:#\-]?\s*([0-9]{4})\b', text, re.IGNORECASE)
    if m_ending:
        return f"XXXX{m_ending.group(1)}", 0.85

    return None, 0.0


def extract_repayment_frequency(text: str) -> str:
    """Detects repayment frequency (monthly, weekly, bi-weekly). Defaults to 'monthly'."""
    lower = text.lower()
    if any(w in lower for w in ["weekly", "per week", "every week"]):
        return "weekly"
    if any(w in lower for w in ["bi-weekly", "biweekly", "every 15 days", "fortnightly"]):
        return "bi-weekly"
    return "monthly"

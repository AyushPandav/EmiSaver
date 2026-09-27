import os
import json
import re
from typing import Optional, Tuple, Dict, Any, List

# Check parent directories for data/lender_lookup.json
CURR_DIR = os.path.dirname(os.path.abspath(__file__))
CANDIDATE_PATHS = [
    os.path.abspath(os.path.join(CURR_DIR, "..", "..", "..", "..", "shared", "ruleset.json")),
    os.path.abspath(os.path.join(CURR_DIR, "..", "..", "..", "shared", "ruleset.json")),
    os.path.abspath(os.path.join(CURR_DIR, "..", "..", "shared", "ruleset.json")),
    os.path.abspath(os.path.join(CURR_DIR, "..", "..", "data", "lender_lookup.json")),
]

FALLBACK_LENDERS = [
    {"canonical_name": "LazyPay", "sender_patterns": ["LAZYPY", "LAZYPAY", "LZPAY"], "keywords": ["lazypay", "payu finance", "lazy pay", "लेजीपे"]},
    {"canonical_name": "KreditBee", "sender_patterns": ["KRDTBI", "KRDBEE", "KREDTB", "KREDITBEE"], "keywords": ["kreditbee", "krazybee", "kredit bee", "क्रेडिटबी", "क्रेडिट बी"]},
    {"canonical_name": "Navi", "sender_patterns": ["NAVITM", "NAVIFN", "NAVI", "NAVILN"], "keywords": ["navi", "navi finserv", "नवी"]},
    {"canonical_name": "Simpl", "sender_patterns": ["SIMPL", "GETSMP", "SMPL"], "keywords": ["simpl", "getsimpl", "सिम्पल"]},
    {"canonical_name": "Slice", "sender_patterns": ["SLICEC", "SLICE", "SLICEN"], "keywords": ["slice", "slice card", "स्लाइस"]},
    {"canonical_name": "CASHe", "sender_patterns": ["CASHE", "CSHEIN"], "keywords": ["cashe", "bhanix finance"]},
    {"canonical_name": "MoneyTap", "sender_patterns": ["MNYTAP", "MONEYTAP"], "keywords": ["moneytap", "money tap"]},
    {"canonical_name": "Bajaj Finserv", "sender_patterns": ["BAJAJF", "BAJAJ", "BFINSV"], "keywords": ["bajaj finserv", "bajaj finance", "बजाज"]},
    {"canonical_name": "ZestMoney", "sender_patterns": ["ZESTMN", "ZEST"], "keywords": ["zestmoney", "zest money"]},
]


class LenderLookup:
    def __init__(self):
        self.lenders: List[Dict[str, Any]] = []
        for path in CANDIDATE_PATHS:
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        # Support either direct array or ruleset dictionary with 'lenders' key
                        self.lenders = data.get("lenders", data) if isinstance(data, dict) else data
                        break
                except Exception:
                    pass
        if not self.lenders:
            self.lenders = FALLBACK_LENDERS

    def identify_lender(self, sender: Optional[str], text: str) -> Tuple[Optional[str], float]:
        """
        Identify lender from sender ID (e.g., 'VM-LAZYPAY', 'BZ-KRDTBI') and text body.
        Returns: (canonical_lender_name, confidence_score)
        """
        norm_sender = (sender or "").upper().replace("-", "").replace("_", "")
        norm_text = text.lower()

        # Step 1: Exact sender header match
        for item in self.lenders:
            for pattern in item.get("sender_patterns", []):
                if pattern in norm_sender:
                    return item["canonical_name"], 0.98

        # Step 2: Exact keyword match in text
        for item in self.lenders:
            for kw in item.get("keywords", []):
                pattern = r'\b' + re.escape(kw) + r'\b'
                if re.search(pattern, norm_text):
                    return item["canonical_name"], 0.95

        # Step 3: Fuzzy / Substring fallback in sender or text
        for item in self.lenders:
            name_clean = item["canonical_name"].lower().replace(" ", "")
            if name_clean in norm_text.replace(" ", ""):
                return item["canonical_name"], 0.85

        # Generic detection (e.g., "loan", "bank", "finance" from sender header)
        if norm_sender:
            parts = re.findall(r'[A-Za-z]{3,}', norm_sender)
            if parts:
                candidate = parts[-1]
                if any(finance_term in candidate.lower() for finance_term in ["loan", "crdt", "krdt", "bank", "fin"]):
                    return candidate.capitalize(), 0.50

        # Generic / Unknown
        return None, 0.0


lender_lookup = LenderLookup()

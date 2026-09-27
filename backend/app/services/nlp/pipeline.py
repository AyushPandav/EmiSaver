from typing import Dict, Any, Optional
from datetime import date
from app.services.nlp.text_cleaner import clean_text
from app.services.nlp.language_detect import detect_language
from app.services.nlp.lender_lookup import lender_lookup
from app.services.nlp.amount_detector import detect_amounts
from app.services.nlp.date_detector import detect_date
from app.services.nlp.classifier import classify_message
from app.services.nlp.entity_extractor import extract_loan_identifier, extract_repayment_frequency
from app.config import settings


class NLPPipeline:
    """
    7-Stage Hybrid NLP Pipeline for SMS and Notification Ingestion:
    1. Language Detection
    2. Text Cleaning
    3. Entity Extraction (Lender, Account ID, Frequency)
    4. Amount Detection (Principal vs EMI)
    5. Date Detection (Due dates, Indian formats)
    6. EMI/Loan Classification
    7. Composite Scoring and Structured Formatting
    """

    def process_message(
        self,
        raw_text: str,
        sender: Optional[str] = None,
        source_message_id: Optional[str] = None,
        reference_date: Optional[date] = None
    ) -> Dict[str, Any]:
        # Stage 1: Language Detection
        lang, lang_conf = detect_language(raw_text)

        # Stage 2: Text Cleaning
        cleaned_text = clean_text(raw_text)

        # Stage 3: Lender Identification
        lender, lender_conf = lender_lookup.identify_lender(sender, cleaned_text)

        # Stage 4: Amount Detection
        loan_amount, emi_amount, amt_conf = detect_amounts(cleaned_text)

        # Stage 5: Date Detection
        due_date, date_conf = detect_date(cleaned_text, reference_date=reference_date)

        # Stage 6: Message Classification
        message_type, class_conf = classify_message(cleaned_text)

        # Stage 7: Identifier & Repayment Frequency
        loan_identifier, id_conf = extract_loan_identifier(cleaned_text)
        frequency = extract_repayment_frequency(cleaned_text)

        # Check if the message is actually loan related
        if message_type == "not_loan_related" and not lender and not (emi_amount or loan_amount):
            is_loan = False
        else:
            is_loan = True

        # Composite Confidence Calculation
        # Weighted:
        # Lender Match (30%)
        # Amount Match (35%)
        # Classification (20%)
        # Date Match (15% if present)
        w_lender = 0.30
        w_amt = 0.35
        w_class = 0.20
        w_date = 0.15

        # Normalization if date is not strictly required (e.g. loan approved message)
        if due_date is None and message_type in ["loan_approved", "payment_confirmed"]:
            w_class += 0.15
            w_date = 0.0

        effective_date_conf = date_conf if due_date else (0.5 if message_type == "loan_approved" else 0.2)
        composite_score = (
            (lender_conf * w_lender) +
            (amt_conf * w_amt) +
            (class_conf * w_class) +
            (effective_date_conf * w_date)
        )

        # Language-detection-confidence calibration penalty (§4.5):
        # Lower-resource languages with less mature parsing rules produce appropriately
        # lower confidence scores rather than false-confident extractions.
        LANG_CONFIDENCE_MULTIPLIERS = {
            "en": 1.00,
            "hinglish": 0.95,
            "hi": 0.90,
            "mr": 0.85,
            "bn": 0.80,
            "ta": 0.80,
            "te": 0.80
        }
        lang_penalty = LANG_CONFIDENCE_MULTIPLIERS.get(lang, 0.75)
        calibrated_score = round(min(1.0, max(0.0, composite_score * lang_penalty)), 2)

        needs_review = (
            calibrated_score < settings.CONFIDENCE_THRESHOLD or
            lender is None or
            (emi_amount is None and loan_amount is None)
        )

        return {
            "lender": lender or "Unknown Lender",
            "loan_identifier": loan_identifier,
            "loan_amount": loan_amount,
            "emi_amount": emi_amount,
            "due_date": due_date,
            "repayment_frequency": frequency,
            "message_type": message_type,
            "language_detected": lang,
            "confidence": calibrated_score,
            "needs_review": needs_review,
            "is_loan_related": is_loan,
            "source_message_id": source_message_id
        }


nlp_pipeline = NLPPipeline()

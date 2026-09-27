import re
from typing import Tuple


def classify_message(text: str) -> Tuple[str, float]:
    """
    Classifies the message into one of:
    - loan_approved
    - emi_generated
    - emi_reminder
    - payment_reminder
    - auto_debit_reminder
    - payment_confirmed
    - overdue_notice
    - not_loan_related
    
    Returns: (message_type, confidence)
    """
    lower = text.lower()

    # Exclusions / Not loan related
    otp_signals = [r'\botp\b', r'one time password', r'verification code', r'do not share']
    if any(re.search(pat, lower) for pat in otp_signals) and not any(w in lower for w in ["emi", "loan"]):
        return "not_loan_related", 0.98

    promo_signals = [r'discount', r'cashback on your order', r'flat \d+% off', r'apply coupon', r'win up to']
    if any(re.search(pat, lower) for pat in promo_signals) and not any(w in lower for w in ["repayment", "due", "overdue", "emi"]):
        return "not_loan_related", 0.90

    # 1. Overdue notice
    if any(w in lower for w in ["overdue", "default", "penalty", "immediate payment", "legal action", "cibil impact"]):
        return "overdue_notice", 0.95

    # 2. Payment confirmed / received
    if any(w in lower for w in ["payment received", "repayment successful", "emi paid", "thank you for payment", "successfully received", "paid successfully"]):
        return "payment_confirmed", 0.95

    # 3. Auto-debit reminder
    if any(w in lower for w in ["auto-debit", "auto debit", "nach", "will be debited", "scheduled for debit", "e-mandate"]):
        return "auto_debit_reminder", 0.93

    # 4. Loan approved / disbursed
    if any(w in lower for w in ["loan approved", "has been approved", "sanctioned", "disbursed to your account", "credit line approved", "congratulations! your loan"]):
        return "loan_approved", 0.95

    # 5. EMI generated
    if any(w in lower for w in ["emi generated", "bill generated", "statement generated", "installment generated", "has been generated"]):
        return "emi_generated", 0.93

    # 6. EMI reminder
    if any(w in lower for w in ["emi reminder", "emi due", "repayment due", "installment due", "emi of", "installment of"]):
        return "emi_reminder", 0.92

    # 7. Payment reminder (general)
    if any(w in lower for w in ["payment reminder", "due on", "due date", "pay before", "avoid late fee", "bill due"]):
        return "payment_reminder", 0.88

    # General financial loan context check
    if any(w in lower for w in ["loan", "emi", "borrow", "lender", "repay"]):
        return "emi_reminder", 0.70

    return "not_loan_related", 0.75

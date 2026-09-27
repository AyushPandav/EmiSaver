from datetime import date
from app.services.nlp.pipeline import nlp_pipeline
from app.services.nlp.amount_detector import detect_amounts
from app.services.nlp.date_detector import detect_date
from app.services.nlp.classifier import classify_message
from app.services.nlp.lender_lookup import lender_lookup


def test_section_8_worked_example_messages():
    """
    Validates §8 Worked Example extraction:
    1. 'Your KreditBee loan of ₹15,000 has been approved.' -> loan_approved
    2. 'Your KreditBee EMI of ₹3,200 has been generated for Sep.' -> emi_generated
    3. '₹3,200 repayment due for your KreditBee loan on 25 Sep.' -> emi_reminder
    """
    ref_date = date(2026, 9, 20)

    # Message 1
    m1 = "Your KreditBee loan of ₹15,000 has been approved."
    res1 = nlp_pipeline.process_message(m1, sender="BZ-KRDTBI", reference_date=ref_date)
    assert res1["lender"] == "KreditBee"
    assert res1["loan_amount"] == 15000.0
    assert res1["message_type"] == "loan_approved"
    assert res1["confidence"] >= 0.60

    # Message 2
    m2 = "Your KreditBee EMI of ₹3,200 has been generated for Sep."
    res2 = nlp_pipeline.process_message(m2, sender="BZ-KRDTBI", reference_date=ref_date)
    assert res2["lender"] == "KreditBee"
    assert res2["emi_amount"] == 3200.0
    assert res2["message_type"] == "emi_generated"

    # Message 3
    m3 = "₹3,200 repayment due for your KreditBee loan on 25 Sep."
    res3 = nlp_pipeline.process_message(m3, sender="BZ-KRDTBI", reference_date=ref_date)
    assert res3["lender"] == "KreditBee"
    assert res3["emi_amount"] == 3200.0
    assert res3["due_date"] is not None
    assert res3["due_date"].day == 25
    assert res3["due_date"].month == 9
    assert res3["message_type"] == "emi_reminder"


def test_multilingual_and_popular_lenders():
    # LazyPay test
    lz = nlp_pipeline.process_message("LazyPay bill of Rs 2,499 due on 23 Sep", sender="VM-LAZYPAY")
    assert lz["lender"] == "LazyPay"
    assert lz["emi_amount"] == 2499.0

    # Navi test
    nv = nlp_pipeline.process_message("Navi auto-debit of INR 1850 scheduled on 28/09/2026", sender="NAVIFN")
    assert nv["lender"] == "Navi"
    assert nv["emi_amount"] == 1850.0
    assert nv["due_date"] == date(2026, 9, 28)

    # OTP exclusion
    otp = nlp_pipeline.process_message("Your OTP for login is 492019. Do not share with anyone.")
    assert otp["message_type"] == "not_loan_related"
    assert otp["is_loan_related"] is False

import pytest
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User, IncomeProfile, Loan, EmiSchedule
from app.services.ratio_engine import ratio_engine
from app.services.loan_simulator import loan_simulator
from app.services.pressure_score_engine import pressure_score_engine
from app.services.calendar_service import calendar_service
from app.services.nlp.pipeline import nlp_pipeline


@pytest.mark.asyncio
async def test_repayment_ratio_worked_example(db_session: AsyncSession):
    """
    Test §7 Worked Example:
    Income = ₹45,000, EMIs = ₹19,500 -> Ratio = 19,500 / 45,000 * 100 = 43.3%
    Safe limit = 40%
    """
    user = User(device_id="ratio-test-device")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    profile = IncomeProfile(
        user_id=user.id,
        monthly_income=45000.0,
        safe_emi_ratio=0.40
    )
    db_session.add(profile)

    loan1 = Loan(user_id=user.id, lender="Lender A", emi_amount=12000.0, repayment_frequency="monthly", status="active")
    loan2 = Loan(user_id=user.id, lender="Lender B", emi_amount=7500.0, repayment_frequency="monthly", status="active")
    db_session.add_all([loan1, loan2])
    await db_session.commit()

    res = await ratio_engine.compute_repayment_ratio(db_session, user.id)

    assert res["monthly_income"] == 45000.0
    assert res["total_monthly_emi"] == 19500.0
    assert res["ratio_pct"] == 43.3
    assert res["safe_limit_pct"] == 40.0
    assert res["is_above_limit"] is True
    assert res["status"] == "above_limit"
    assert "above your preferred" in res["message"]


@pytest.mark.asyncio
async def test_frequency_normalization(db_session: AsyncSession):
    """
    Test non-monthly loan frequency normalization (§4.2):
    Weekly ₹1,000 * 4.33 = ₹4,330/mo
    Monthly ₹10,000 = ₹10,000/mo
    Total = ₹14,330/mo
    """
    user = User(device_id="freq-test-device")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    profile = IncomeProfile(user_id=user.id, monthly_income=50000.0, safe_emi_ratio=0.35)
    db_session.add(profile)

    loan_m = Loan(user_id=user.id, lender="Bank A", emi_amount=10000.0, repayment_frequency="monthly", status="active")
    loan_w = Loan(user_id=user.id, lender="Fintech B", emi_amount=1000.0, repayment_frequency="weekly", status="active")
    db_session.add_all([loan_m, loan_w])
    await db_session.commit()

    res = await ratio_engine.compute_repayment_ratio(db_session, user.id)
    assert res["total_monthly_emi"] == 14330.0
    assert res["normalization_notes"] is not None
    assert any("factor 4.33" in note for note in res["normalization_notes"])


@pytest.mark.asyncio
async def test_new_loan_simulation_worked_example(db_session: AsyncSession):
    """
    Test §7 Worked Example:
    Current EMI: ₹16,000 -> 35.6%
    New EMI: ₹3,500
    Combined: ₹19,500 -> 43.3%
    Delta: +7.7 percentage points, +₹3,500 commitment
    Simulations are NOT persisted as active loans.
    """
    user = User(device_id="sim-test-device")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    profile = IncomeProfile(user_id=user.id, monthly_income=45000.0, safe_emi_ratio=0.40)
    db_session.add(profile)

    # Active loans totaling 16,000
    loan1 = Loan(user_id=user.id, lender="Lender 1", emi_amount=16000.0, repayment_frequency="monthly", status="active")
    db_session.add(loan1)
    await db_session.commit()

    sim_res = await loan_simulator.simulate(
        session=db_session,
        user_id=user.id,
        new_emi=3500.0,
        duration_months=6,
        loan_amount=20000.0,
        preferred_due_day=25,
        save_history=True
    )

    assert sim_res["current_emi"] == 16000.0
    assert sim_res["new_emi"] == 3500.0
    assert sim_res["combined_emi"] == 19500.0
    assert sim_res["ratio_before"] == 35.6
    assert sim_res["ratio_after"] == 43.3
    assert sim_res["delta_pp"] == 7.7
    assert sim_res["is_above_safe_limit"] is True
    assert sim_res["additional_monthly_commitment"] == 3500.0
    assert "calendar_impact" in sim_res

    # Verify no new Loan was inserted into the loans table
    all_loans = (await db_session.execute(select(Loan).where(Loan.user_id == user.id))).scalars().all()
    assert len(all_loans) == 1


@pytest.mark.asyncio
async def test_collision_detection_worked_example(db_session: AsyncSession):
    """
    Test §7 Worked Example:
    25 Sep -> ₹4,500
    26 Sep -> ₹3,200
    27 Sep -> ₹5,000
    28 Sep -> ₹2,800
    Window total: ₹15,500 over 4 days, min gap 1 day -> High concentration / pressure score > 70
    """
    user = User(device_id="collision-test-device")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Income ₹45k, salary on 1st of month (days 25-28 are pre-salary!)
    profile = IncomeProfile(user_id=user.id, monthly_income=45000.0, salary_date=1, safe_emi_ratio=0.40)
    db_session.add(profile)

    # 4 loans with repayments from today+5 to today+8 to ensure they fall within active lookahead
    today = date.today()
    d1 = today + timedelta(days=5)
    d2 = today + timedelta(days=6)
    d3 = today + timedelta(days=7)
    d4 = today + timedelta(days=8)

    loan1 = Loan(user_id=user.id, lender="Lender 1", emi_amount=4500.0, status="active")
    loan2 = Loan(user_id=user.id, lender="Lender 2", emi_amount=3200.0, status="active")
    loan3 = Loan(user_id=user.id, lender="Lender 3", emi_amount=5000.0, status="active")
    loan4 = Loan(user_id=user.id, lender="Lender 4", emi_amount=2800.0, status="active")
    db_session.add_all([loan1, loan2, loan3, loan4])
    await db_session.flush()

    s1 = EmiSchedule(loan_id=loan1.id, due_date=d1, amount=4500.0, paid=False)
    s2 = EmiSchedule(loan_id=loan2.id, due_date=d2, amount=3200.0, paid=False)
    s3 = EmiSchedule(loan_id=loan3.id, due_date=d3, amount=5000.0, paid=False)
    s4 = EmiSchedule(loan_id=loan4.id, due_date=d4, amount=2800.0, paid=False)
    db_session.add_all([s1, s2, s3, s4])
    await db_session.commit()

    windows = await pressure_score_engine.detect_and_save_windows(db_session, user.id)

    assert len(windows) >= 1
    w = windows[0]
    assert w["total_due"] == 15500.0
    assert w["pressure_score"] > 70.0
    assert w["severity"] == "high"
    assert w["contributing_factors"]["min_gap_days"] == 1
    assert w["contributing_factors"]["active_loan_count"] == 4


@pytest.mark.asyncio
async def test_unified_calendar(db_session: AsyncSession):
    """
    Test Unified Calendar day aggregation and month totals.
    """
    user = User(device_id="calendar-test-device")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    today = date.today()
    # Add two loans due on the 10th of this month
    target_date = date(today.year, today.month, 10)

    loan1 = Loan(user_id=user.id, lender="Lender X", emi_amount=2000.0, status="active")
    loan2 = Loan(user_id=user.id, lender="Lender Y", emi_amount=3000.0, status="active")
    db_session.add_all([loan1, loan2])
    await db_session.flush()

    s1 = EmiSchedule(loan_id=loan1.id, due_date=target_date, amount=2000.0, paid=False)
    s2 = EmiSchedule(loan_id=loan2.id, due_date=target_date, amount=3000.0, paid=False)
    db_session.add_all([s1, s2])
    await db_session.commit()

    cal = await calendar_service.get_unified_calendar(db_session, user.id, target_year=today.year, target_month=today.month)

    assert cal["this_month_total"] == 5000.0
    # Day 10 should have aggregated 5000 across 2 items
    day10 = next(d for d in cal["days"] if d["day_of_month"] == 10)
    assert day10["total_amount"] == 5000.0
    assert len(day10["items"]) == 2
    assert {i["lender"] for i in day10["items"]} == {"Lender X", "Lender Y"}


def test_multilingual_nlp_pipeline():
    """
    Test §4.5 & §8 Multi-language NLP parsing:
    - Hindi Devanagari message
    - Tamil message
    - Bengali message with Bengali numerals
    - Language-independent output schema
    - Calibrated confidence penalty
    """
    # 1. Hindi Devanagari message
    hindi_msg = "क्रेडिटबी की तरफ से आपकी EMI ₹2500 की है जो 25 सितंबर को देय है"
    res_hi = nlp_pipeline.process_message(hindi_msg, sender="KRDTBI")

    assert res_hi["language_detected"] == "hi"
    assert res_hi["emi_amount"] == 2500.0
    assert res_hi["due_date"].month == 9
    assert res_hi["due_date"].day == 25
    assert res_hi["lender"] == "KreditBee"

    # 2. Tamil message
    tamil_msg = "உங்கள் கடன் இஎம்ஐ ரூ 3200 15 அக்டோபர் செலுத்த வேண்டும்"
    res_ta = nlp_pipeline.process_message(tamil_msg, sender="AD-BAJFIN")

    assert res_ta["language_detected"] == "ta"
    assert res_ta["emi_amount"] == 3200.0
    assert res_ta["due_date"].month == 10
    assert res_ta["due_date"].day == 15

    # 3. Bengali message with Bengali numerals (১৮০০ = 1800, ২০ = 20)
    bengali_msg = "আপনার ঋণ কিস্তি ₹১৮০০ আগামী ২০ অক্টোবর প্রদেয়"
    res_bn = nlp_pipeline.process_message(bengali_msg, sender="SIMPL")

    assert res_bn["language_detected"] == "bn"
    assert res_bn["emi_amount"] == 1800.0
    assert res_bn["due_date"].month == 10
    assert res_bn["due_date"].day == 20

    # 4. Compare confidence calibration against equivalent English message
    english_msg = "Your EMI of Rs 2500 for KreditBee is due on 25 September"
    res_en = nlp_pipeline.process_message(english_msg, sender="KRDTBI")

    # English has 1.0 multiplier, non-English has calibrated penalty (< 1.0)
    assert res_en["confidence"] >= res_hi["confidence"]
    assert res_hi["confidence"] >= res_ta["confidence"]

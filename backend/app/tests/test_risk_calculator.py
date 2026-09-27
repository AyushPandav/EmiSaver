import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import User, IncomeProfile, Loan
from app.services.risk_calculator import risk_calculator


@pytest.mark.asyncio
async def test_risk_status_transitions(db_session: AsyncSession):
    # Setup User & Income Profile (45,000 income, 40% safe ratio)
    user = User(device_id="risk-test-device")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    profile = IncomeProfile(
        user_id=user.id,
        monthly_income=45000.0,
        safe_emi_ratio=0.40,
        fixed_expenses=18000.0
    )
    db_session.add(profile)
    await db_session.commit()

    # Case 1: Safe Band (<= 70% of safe limit of 18,000 -> <= 12,600)
    loan1 = Loan(user_id=user.id, lender="LazyPay", emi_amount=8000.0, status="active")
    db_session.add(loan1)
    await db_session.commit()

    snap1 = await risk_calculator.compute_and_save_snapshot(db_session, user.id)
    assert snap1["risk_status"] == "safe"
    assert snap1["total_emi"] == 8000.0
    assert snap1["max_safe_emi"] == 18000.0

    # Case 2: Caution Band (70-100% of safe limit -> 12,600 to 18,000)
    # Adding KreditBee 8,750 -> Total 16,750 (37.2% of income, ~93% utilization)
    loan2 = Loan(user_id=user.id, lender="KreditBee", emi_amount=8750.0, status="active")
    db_session.add(loan2)
    await db_session.commit()

    snap2 = await risk_calculator.compute_and_save_snapshot(db_session, user.id)
    assert snap2["risk_status"] == "caution"
    assert snap2["total_emi"] == 16750.0
    assert snap2["emi_to_income_pct"] == 37.2

    # Case 3: Over-limit Band (> 100% of safe limit -> > 18,000)
    # Adding Navi 5,000 -> Total 21,750 (> 18,000)
    loan3 = Loan(user_id=user.id, lender="Navi", emi_amount=5000.0, status="active")
    db_session.add(loan3)
    await db_session.commit()

    snap3 = await risk_calculator.compute_and_save_snapshot(db_session, user.id)
    assert snap3["risk_status"] == "over_limit"
    assert snap3["total_emi"] == 21750.0
    assert "exceed your safe threshold" in snap3["risk_message"]

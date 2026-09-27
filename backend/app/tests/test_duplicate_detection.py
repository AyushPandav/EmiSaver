import pytest
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User, Loan, ParsedLoanEvent, EmiSchedule
from app.services.nlp.pipeline import nlp_pipeline
from app.services.duplicate_detector import duplicate_detector


@pytest.mark.asyncio
async def test_section_8_worked_example_duplicate_merging(db_session: AsyncSession):
    """
    Tests §8 Worked Example:
    Three raw messages for the same underlying loan:
    1. 'Your KreditBee loan of ₹15,000 has been approved.'
    2. 'Your KreditBee EMI of ₹3,200 has been generated for Sep.'
    3. '₹3,200 repayment due for your KreditBee loan on 25 Sep.'

    Expected system behavior: all three resolve to a single loans row
    (lender=KreditBee, emi_amount=3200), with three linked parsed_loan_events rows,
    and one emi_schedule row for the 25 Sep due date generated from event #3.
    """
    # 1. Setup user
    user = User(device_id="test-device-uuid-123")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    ref_date = date(2026, 9, 20)
    messages = [
        "Your KreditBee loan of ₹15,000 has been approved.",
        "Your KreditBee EMI of ₹3,200 has been generated for Sep.",
        "₹3,200 repayment due for your KreditBee loan on 25 Sep."
    ]

    for msg in messages:
        nlp_res = nlp_pipeline.process_message(msg, sender="BZ-KRDTBI", reference_date=ref_date)
        await duplicate_detector.merge_or_create_loan(
            session=db_session,
            user_id=user.id,
            parsed_event_data=nlp_res
        )
    await db_session.commit()

    # Verify: Single canonical loans row
    loans_stmt = select(Loan).where(Loan.user_id == user.id)
    loans = (await db_session.execute(loans_stmt)).scalars().all()
    assert len(loans) == 1
    loan = loans[0]
    assert loan.lender == "KreditBee"
    assert float(loan.emi_amount) == 3200.0
    assert float(loan.principal_amount) == 15000.0

    # Verify: Three linked parsed_loan_events rows
    events_stmt = select(ParsedLoanEvent).where(ParsedLoanEvent.matched_loan_id == loan.id)
    events = (await db_session.execute(events_stmt)).scalars().all()
    assert len(events) == 3

    # Verify: One emi_schedule row for 25 Sep
    sched_stmt = select(EmiSchedule).where(EmiSchedule.loan_id == loan.id)
    schedules = (await db_session.execute(sched_stmt)).scalars().all()
    assert len(schedules) == 1
    sched = schedules[0]
    assert sched.due_date.day == 25
    assert sched.due_date.month == 9
    assert float(sched.amount) == 3200.0

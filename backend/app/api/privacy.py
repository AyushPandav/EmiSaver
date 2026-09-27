from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models import (
     User, IncomeProfile, Loan, EmiSchedule,
     ParsedLoanEvent, UserCorrection, RiskSnapshot,
     PressureWindow, LoanSimulation, RawMessage
)
from app.schemas import PurgeMessagesResponse, PrivacyExportResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/privacy", tags=["Privacy Center"])


@router.post("/delete-all")
async def delete_all_user_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Phase 3 Privacy Center:
    Single action that cascades through all user records
    (loans, schedules, parsed events, corrections, simulations, pressure windows, raw messages).
    Exposes a real, working cascading wipe.
    """
    # Delete related tables explicitly to ensure clean cleanup across all DB dialects
    await db.execute(delete(EmiSchedule).where(EmiSchedule.loan_id.in_(
        select(Loan.id).where(Loan.user_id == current_user.id)
    )))
    await db.execute(delete(UserCorrection).where(UserCorrection.user_id == current_user.id))
    await db.execute(delete(ParsedLoanEvent).where(ParsedLoanEvent.user_id == current_user.id))
    await db.execute(delete(Loan).where(Loan.user_id == current_user.id))
    await db.execute(delete(PressureWindow).where(PressureWindow.user_id == current_user.id))
    await db.execute(delete(LoanSimulation).where(LoanSimulation.user_id == current_user.id))
    await db.execute(delete(RiskSnapshot).where(RiskSnapshot.user_id == current_user.id))
    await db.execute(delete(RawMessage).where(RawMessage.user_id == current_user.id))
    await db.execute(delete(IncomeProfile).where(IncomeProfile.user_id == current_user.id))
    
    await db.commit()

    return {
        "status": "success",
        "message": "All user financial records, loans, events, and message data have been permanently deleted."
    }


@router.post("/purge-raw-messages", response_model=PurgeMessagesResponse)
async def purge_raw_messages(
    only_expired: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Phase 3 Privacy Center:
    Bulk delete raw messages. If only_expired is True, deletes rows where retention_expires_at <= now.
    If False, wipes all raw messages for the user immediately.
    """
    if only_expired:
        stmt = delete(RawMessage).where(
            RawMessage.user_id == current_user.id,
            RawMessage.retention_expires_at != None,
            RawMessage.retention_expires_at <= datetime.utcnow()
        )
    else:
        stmt = delete(RawMessage).where(RawMessage.user_id == current_user.id)

    result = await db.execute(stmt)
    await db.commit()
    purged_count = result.rowcount if hasattr(result, "rowcount") else 0

    return PurgeMessagesResponse(
        purged_count=max(purged_count, 0),
        message=f"Purged {max(purged_count, 0)} raw message record(s) from server storage."
    )


@router.get("/export", response_model=PrivacyExportResponse)
async def export_user_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Phase 3 Privacy Center:
    Portable JSON export of the user's structured loan data, income profile, and schedules.
    """
    # 1. Income Profile
    inc_stmt = select(IncomeProfile).where(IncomeProfile.user_id == current_user.id)
    inc = (await db.execute(inc_stmt)).scalar_one_or_none()
    income_data = {
        "monthly_income": float(inc.monthly_income),
        "salary_date": inc.salary_date,
        "fixed_expenses": float(inc.fixed_expenses or 0),
        "safe_emi_ratio": float(inc.safe_emi_ratio),
    } if inc else None

    # 2. Loans
    loans_stmt = select(Loan).where(Loan.user_id == current_user.id)
    loans = (await db.execute(loans_stmt)).scalars().all()
    loans_data = [
        {
            "id": l.id,
            "lender": l.lender,
            "loan_identifier": l.loan_identifier,
            "principal_amount": float(l.principal_amount) if l.principal_amount else None,
            "emi_amount": float(l.emi_amount),
            "repayment_frequency": l.repayment_frequency,
            "status": l.status,
            "source_confidence": float(l.source_confidence) if l.source_confidence else None,
            "manually_verified": l.manually_verified,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in loans
    ]

    # 3. EMI Schedules
    loan_ids = [l.id for l in loans]
    sched_data = []
    if loan_ids:
        sched_stmt = select(EmiSchedule).where(EmiSchedule.loan_id.in_(loan_ids))
        schedules = (await db.execute(sched_stmt)).scalars().all()
        sched_data = [
            {
                "id": s.id,
                "loan_id": s.loan_id,
                "due_date": s.due_date.isoformat(),
                "amount": float(s.amount),
                "paid": s.paid,
            }
            for s in schedules
        ]

    # 4. Parsed Loan Events (structured only)
    events_stmt = select(ParsedLoanEvent).where(ParsedLoanEvent.user_id == current_user.id)
    events = (await db.execute(events_stmt)).scalars().all()
    events_data = [
        {
            "id": e.id,
            "lender": e.lender,
            "loan_identifier": e.loan_identifier,
            "emi_amount": float(e.emi_amount) if e.emi_amount else None,
            "due_date": e.due_date.isoformat() if e.due_date else None,
            "message_type": e.message_type,
            "confidence": float(e.confidence) if e.confidence else None,
            "field_confidence": e.field_confidence,
            "local_message_ref": e.local_message_ref,
        }
        for e in events
    ]

    # 5. Pressure Windows
    windows_stmt = select(PressureWindow).where(PressureWindow.user_id == current_user.id)
    windows = (await db.execute(windows_stmt)).scalars().all()
    windows_data = [
        {
            "id": w.id,
            "window_start": w.window_start.isoformat(),
            "window_end": w.window_end.isoformat(),
            "total_due": float(w.total_due),
            "pressure_score": float(w.pressure_score),
            "severity": w.severity,
            "contributing_factors": w.contributing_factors,
        }
        for w in windows
    ]

    return PrivacyExportResponse(
        user_id=current_user.id,
        exported_at=datetime.utcnow(),
        income_profile=income_data,
        loans=loans_data,
        emi_schedules=sched_data,
        loan_events=events_data,
        pressure_windows=windows_data
    )

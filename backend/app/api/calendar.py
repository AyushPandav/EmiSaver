from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User
from app.schemas import CalendarResponse, UnifiedCalendarResponse
from app.api.deps import get_current_user
from app.services.loan_manager import loan_manager
from app.services.calendar_service import calendar_service

router = APIRouter(prefix="/calendar", tags=["Calendar & Repayments"])


@router.get("/upcoming", response_model=CalendarResponse)
async def get_upcoming_repayments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns chronological upcoming repayments across all active loans.
    """
    entries = await loan_manager.get_upcoming_calendar(db, current_user.id)
    total_amt = sum(e["amount"] for e in entries if not e["paid"])
    return CalendarResponse(
        upcoming_repayments=entries,
        total_upcoming_amount=round(total_amt, 2)
    )


@router.get("/unified", response_model=UnifiedCalendarResponse)
async def get_unified_calendar(
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (1-12)"),
    year: Optional[int] = Query(None, ge=2020, le=2050, description="Year (e.g. 2026)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Unified Repayment Calendar (§4.1):
    Returns day-aggregated EMI totals across all loans for the requested month,
    traceable day items, this/next month totals, and busiest week window.
    """
    return await calendar_service.get_unified_calendar(
        session=db,
        user_id=current_user.id,
        target_year=year,
        target_month=month
    )


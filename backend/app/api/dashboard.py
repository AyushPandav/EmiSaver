from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User
from app.schemas import DashboardSummary
from app.api.deps import get_current_user
from app.services.risk_calculator import risk_calculator

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns unified EMI and Income summary, active loans count, and color-coded risk assessment.
    """
    summary = await risk_calculator.compute_and_save_snapshot(db, current_user.id)
    await db.commit()
    return summary

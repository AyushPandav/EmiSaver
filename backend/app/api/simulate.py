from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User
from app.schemas import LoanSimulationRequest, LoanSimulationResponse
from app.api.deps import get_current_user
from app.services.loan_simulator import loan_simulator

router = APIRouter(prefix="/simulate", tags=["Loan Simulation"])


@router.post("/new-loan", response_model=LoanSimulationResponse)
async def simulate_new_loan(
    sim_data: LoanSimulationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Stateless "What-if" New Loan Simulation (§4.3 & §5):
    Evaluates hypothetical addition of a new EMI commitment:
    - Calculates before/after repayment ratios and percentage point delta
    - Analyzes calendar concentration impact on future due dates
    - Strictly non-verdict reporting: informs without deciding
    - Does NOT persist as an active loan
    """
    res = await loan_simulator.simulate(
        session=db,
        user_id=current_user.id,
        new_emi=sim_data.new_emi,
        duration_months=sim_data.duration_months,
        loan_amount=sim_data.loan_amount,
        preferred_due_day=sim_data.preferred_due_day,
        save_history=True
    )
    await db.commit()
    return res

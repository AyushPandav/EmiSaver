from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User, IncomeProfile
from app.schemas import UserCreate, UserResponse, IncomeProfileCreate, IncomeProfileResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/users", tags=["Users & Onboarding"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create or return existing user profile by device_id."""
    stmt = select(User).where(User.device_id == payload.device_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        user = User(device_id=payload.device_id)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


@router.post("/{user_id}/income-profile", response_model=IncomeProfileResponse)
async def save_income_profile(
    user_id: str,
    payload: IncomeProfileCreate,
    db: AsyncSession = Depends(get_db)
):
    """Save or update income, fixed expenses, safe EMI ratio, and emergency buffer."""
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for existing profile
    prof_stmt = select(IncomeProfile).where(IncomeProfile.user_id == user_id)
    profile = (await db.execute(prof_stmt)).scalar_one_or_none()

    if not profile:
        profile = IncomeProfile(user_id=user_id)
        db.add(profile)

    profile.monthly_income = payload.monthly_income
    profile.salary_date = payload.salary_date
    profile.fixed_expenses = payload.fixed_expenses
    profile.safe_emi_ratio = payload.safe_emi_ratio
    profile.emergency_buffer = payload.emergency_buffer

    await db.commit()
    await db.refresh(profile)

    # Compute Max Safe EMI based on methodology
    # Default is gross: Monthly Income * Safe EMI Ratio
    # If net: (Monthly Income - Fixed Expenses) * Safe EMI Ratio
    if payload.calculation_method == "net":
        max_safe = max(0.0, (payload.monthly_income - payload.fixed_expenses)) * payload.safe_emi_ratio
    else:
        max_safe = payload.monthly_income * payload.safe_emi_ratio

    return IncomeProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        monthly_income=float(profile.monthly_income),
        salary_date=profile.salary_date,
        fixed_expenses=float(profile.fixed_expenses or 0),
        safe_emi_ratio=float(profile.safe_emi_ratio),
        emergency_buffer=float(profile.emergency_buffer or 0),
        max_safe_emi=round(max_safe, 2),
        updated_at=profile.updated_at
    )


@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Retrieve current authenticated user."""
    return current_user

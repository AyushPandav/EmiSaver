from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User, PressureWindow
from app.schemas import (
    RepaymentRatioResponse,
    PressureWindowResponse,
    PressureWindowListResponse,
    RiskExplanationResponse
)
from app.api.deps import get_current_user
from app.services.ratio_engine import ratio_engine
from app.services.pressure_score_engine import pressure_score_engine

router = APIRouter(prefix="/risk", tags=["Risk & Repayment Intelligence"])


@router.get("/ratio", response_model=RepaymentRatioResponse)
async def get_repayment_ratio(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Repayment-to-Income Ratio (§4.2 & §5):
    Returns current active EMI burden against user's configured safe limit,
    frequency normalization notes, and snapshot trend delta.
    """
    res = await ratio_engine.compute_repayment_ratio(db, current_user.id)
    await db.commit()
    return res


@router.get("/pressure-windows", response_model=PressureWindowListResponse)
async def get_pressure_windows(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Payment Pressure Score Windows (§4.4 & §5):
    Detects high-concentration repayment clusters in rolling windows
    with factor breakdowns and composite pressure scores.
    """
    windows = await pressure_score_engine.detect_and_save_windows(db, current_user.id)
    await db.commit()

    # Determine highest severity
    highest_sev = None
    high_count = 0
    for w in windows:
        sev = w["severity"]
        if sev == "high":
            highest_sev = "high"
            high_count += 1
        elif sev == "caution" and highest_sev != "high":
            highest_sev = "caution"
        elif sev == "info" and highest_sev is None:
            highest_sev = "info"

    return PressureWindowListResponse(
        active_windows=windows,
        highest_severity=highest_sev,
        total_high_pressure_windows=high_count
    )


@router.get("/pressure-windows/{window_id}", response_model=PressureWindowResponse)
async def get_pressure_window_detail(
    window_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Detail view of a specific Payment Pressure window and its contributing factors (§5).
    """
    stmt = select(PressureWindow).where(
        PressureWindow.id == window_id,
        PressureWindow.user_id == current_user.id
    )
    window = (await db.execute(stmt)).scalar_one_or_none()

    if not window:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pressure window not found"
        )

    return window


@router.get("/explain/{snapshot_id}", response_model=RiskExplanationResponse)
async def explain_risk_snapshot(
    snapshot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Phase 3 Explainable Warning:
    Provides deterministic, rule-based plain-language explanation and factor bullets
    for a risk snapshot (or 'current').
    """
    from app.models import RiskSnapshot, Loan, IncomeProfile
    
    if snapshot_id == "current":
        stmt = select(RiskSnapshot).where(
            RiskSnapshot.user_id == current_user.id
        ).order_by(RiskSnapshot.computed_at.desc())
        snapshot = (await db.execute(stmt)).scalars().first()
    else:
        stmt = select(RiskSnapshot).where(
            RiskSnapshot.id == snapshot_id,
            RiskSnapshot.user_id == current_user.id
        )
        snapshot = (await db.execute(stmt)).scalar_one_or_none()

    # Fetch active loans and income
    loans_stmt = select(Loan).where(Loan.user_id == current_user.id, Loan.status == "active")
    loans = (await db.execute(loans_stmt)).scalars().all()

    income_stmt = select(IncomeProfile).where(IncomeProfile.user_id == current_user.id)
    profile = (await db.execute(income_stmt)).scalar_one_or_none()
    monthly_income = float(profile.monthly_income) if profile else 0.0
    safe_ratio_pct = float(profile.safe_emi_ratio * 100) if profile else 40.0

    total_emi = float(snapshot.total_emi) if snapshot else sum(float(l.emi_amount) for l in loans)
    ratio_pct = float(snapshot.emi_to_income_pct) if snapshot else ((total_emi / monthly_income * 100) if monthly_income > 0 else 0.0)
    risk_status = snapshot.risk_status if snapshot else ("over_limit" if ratio_pct > safe_ratio_pct else ("caution" if ratio_pct > safe_ratio_pct * 0.8 else "safe"))

    bullets = [
        f"{len(loans)} active EMI{'s' if len(loans) != 1 else ''}",
        f"₹{total_emi:,.0f} total monthly repayment",
        f"₹{monthly_income:,.0f} monthly take-home income",
        f"{ratio_pct:.1f}% repayment-to-income ratio (safe limit: {safe_ratio_pct:.0f}%)",
    ]

    # Deterministic templated closing summary
    if ratio_pct > safe_ratio_pct:
        summary = f"Your combined monthly EMI commitments exceed your configured safe threshold of {safe_ratio_pct:.0f}%. Default risk is elevated."
    elif ratio_pct > safe_ratio_pct * 0.8:
        summary = f"Your repayment obligations are near your safe limit of {safe_ratio_pct:.0f}%. Taking additional loans may cause repayment strain."
    else:
        summary = f"Your monthly repayment commitments are within your healthy financial buffer of {safe_ratio_pct:.0f}%."

    return RiskExplanationResponse(
        risk_status=risk_status,
        repayment_ratio_pct=ratio_pct,
        monthly_income=monthly_income,
        total_monthly_emi=total_emi,
        bullets=bullets,
        plain_language_summary=summary,
        evaluated_factors={
            "loan_count": len(loans),
            "safe_limit_pct": safe_ratio_pct,
            "over_limit": ratio_pct > safe_ratio_pct
        }
    )


@router.get("/explain/pressure-window/{window_id}", response_model=RiskExplanationResponse)
async def explain_pressure_window(
    window_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Phase 3 Explainable Warning:
    Provides plain-language breakdown for a specific Payment Pressure Window.
    """
    stmt = select(PressureWindow).where(
        PressureWindow.id == window_id,
        PressureWindow.user_id == current_user.id
    )
    window = (await db.execute(stmt)).scalar_one_or_none()
    if not window:
        raise HTTPException(status_code=404, detail="Pressure window not found")

    factors = window.contributing_factors or {}
    total_due = float(window.total_due)
    window_days = (window.window_end - window.window_start).days + 1
    ins_count = factors.get("installment_count", 0)

    bullets = [
        f"{ins_count} repayments due between {window.window_start.strftime('%d %b')} and {window.window_end.strftime('%d %b')}",
        f"₹{total_due:,.0f} clustered repayment within {window_days} days",
        f"Pressure score: {float(window.pressure_score):.1f}/100 ({window.severity.title()} severity)",
    ]

    if factors.get("pre_salary_days", 0) > 0:
        bullets.append(f"Due {factors.get('pre_salary_days')} days before expected salary credit")

    # Template-driven summary
    if factors.get("pre_salary_days", 0) > 0 and float(factors.get("concentration_ratio", 0)) > 0.5:
        summary = "Your repayment commitments are heavily concentrated just before your salary date, creating an elevated risk of cash shortfall."
    elif window.severity == "high":
        summary = "High concentration of repayments in a short window. Consider prioritizing or staggering payment dates."
    else:
        summary = "Moderate repayment concentration. Ensure sufficient account balance before these due dates."

    return RiskExplanationResponse(
        risk_status=window.severity,
        repayment_ratio_pct=0.0,
        monthly_income=0.0,
        total_monthly_emi=total_due,
        bullets=bullets,
        plain_language_summary=summary,
        evaluated_factors=factors
    )


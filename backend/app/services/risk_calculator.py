from typing import Dict, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models import Loan, IncomeProfile, RiskSnapshot


class RiskCalculator:
    """
    Computes EMI/Income ratio and risk classification according to §6.5:
    - Safe: <= 70% of safe ratio limit
    - Caution: 70% - 100% of safe ratio limit
    - Over-limit: > 100% of safe ratio limit
    """

    async def compute_and_save_snapshot(
        self,
        session: AsyncSession,
        user_id: str
    ) -> Dict[str, Any]:
        # 1. Fetch user income profile
        income_stmt = select(IncomeProfile).where(IncomeProfile.user_id == user_id)
        income_profile = (await session.execute(income_stmt)).scalar_one_or_none()

        monthly_income = float(income_profile.monthly_income) if income_profile else 0.0
        safe_ratio = float(income_profile.safe_emi_ratio) if income_profile else 0.40
        fixed_expenses = float(income_profile.fixed_expenses) if income_profile else 0.0

        # 2. Sum all active loans' EMI amounts
        loans_stmt = select(Loan).where(
            Loan.user_id == user_id,
            Loan.status == "active"
        )
        loans = (await session.execute(loans_stmt)).scalars().all()
        total_emi = sum(float(l.emi_amount) for l in loans if l.emi_amount)
        active_loans_count = len(loans)

        # 3. Calculate metrics
        max_safe_emi = monthly_income * safe_ratio
        emi_to_income_pct = (total_emi / monthly_income * 100.0) if monthly_income > 0 else 0.0
        safe_ratio_pct = safe_ratio * 100.0

        # 4. Status determination
        # Percentage of safe limit consumed:
        # e.g., if safe limit is 40% of income, and current EMI is 37.2%, then 37.2 / 40 = 93% (Caution)
        ratio_utilization = (emi_to_income_pct / safe_ratio_pct) if safe_ratio_pct > 0 else 1.0

        if ratio_utilization <= 0.70:
            status = "safe"
            message = f"Your EMIs are {emi_to_income_pct:.1f}% of income — well within your {safe_ratio_pct:.0f}% safe limit."
        elif ratio_utilization <= 1.00:
            status = "caution"
            message = f"Your EMIs are {emi_to_income_pct:.1f}% of income — approaching your {safe_ratio_pct:.0f}% safe limit."
        else:
            status = "over_limit"
            message = f"Warning: Your EMIs ({emi_to_income_pct:.1f}%) exceed your safe threshold of {safe_ratio_pct:.0f}% by ₹{total_emi - max_safe_emi:,.0f}."

        # 5. Persist RiskSnapshot
        snapshot = RiskSnapshot(
            user_id=user_id,
            total_emi=round(total_emi, 2),
            emi_to_income_pct=round(emi_to_income_pct, 2),
            risk_status=status
        )
        session.add(snapshot)
        await session.flush()

        return {
            "monthly_income": monthly_income,
            "total_emi": total_emi,
            "emi_to_income_pct": round(emi_to_income_pct, 1),
            "safe_emi_ratio_pct": safe_ratio_pct,
            "max_safe_emi": max_safe_emi,
            "active_loans_count": active_loans_count,
            "risk_status": status,
            "currency": "₹",
            "risk_message": message
        }


risk_calculator = RiskCalculator()

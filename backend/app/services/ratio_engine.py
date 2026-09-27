from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models import Loan, IncomeProfile, RiskSnapshot


FREQUENCY_MULTIPLIERS = {
    "weekly": 4.33,
    "bi-weekly": 2.17,
    "biweekly": 2.17,
    "monthly": 1.00,
    "quarterly": 1.0 / 3.0,
    "yearly": 1.0 / 12.0,
    "annual": 1.0 / 12.0
}


class RatioEngine:
    """
    Repayment-to-Income Ratio Engine (§4.2):
    - Computes Repayment Ratio = (Total Active Monthly EMI / Monthly Take-home Income) * 100
    - Normalizes non-monthly loan frequencies (weekly * 4.33, biweekly * 2.17)
    - Compares against user's configured safe_emi_ratio (never hardcoded)
    - Calculates month-over-month / snapshot trend delta
    - Enforces non-verdict, objective communication philosophy
    """

    def normalize_to_monthly(self, emi_amount: float, frequency: Optional[str]) -> Tuple[float, Optional[str]]:
        freq = (frequency or "monthly").lower().strip()
        multiplier = FREQUENCY_MULTIPLIERS.get(freq, 1.0)
        normalized = emi_amount * multiplier
        note = None
        if multiplier != 1.0:
            note = f"Normalized {freq} EMI ₹{emi_amount:,.2f} using factor {multiplier:.2f} -> ₹{normalized:,.2f}/mo"
        return normalized, note

    async def compute_repayment_ratio(
        self,
        session: AsyncSession,
        user_id: str,
        persist_snapshot: bool = True
    ) -> Dict[str, Any]:
        # 1. Fetch Income Profile
        stmt_income = select(IncomeProfile).where(IncomeProfile.user_id == user_id)
        income_profile = (await session.execute(stmt_income)).scalar_one_or_none()

        monthly_income = float(income_profile.monthly_income) if income_profile else 0.0
        safe_ratio = float(income_profile.safe_emi_ratio) if income_profile else 0.40
        safe_limit_pct = round(safe_ratio * 100.0, 1)

        # 2. Fetch Active Loans & Normalize
        stmt_loans = select(Loan).where(
            Loan.user_id == user_id,
            Loan.status == "active"
        )
        loans = (await session.execute(stmt_loans)).scalars().all()

        total_monthly_emi = 0.0
        normalization_notes: List[str] = []

        for loan in loans:
            raw_emi = float(loan.emi_amount)
            normalized_emi, note = self.normalize_to_monthly(raw_emi, loan.repayment_frequency)
            total_monthly_emi += normalized_emi
            if note:
                normalization_notes.append(f"{loan.lender}: {note}")

        # 3. Calculate Ratio
        ratio_pct = (total_monthly_emi / monthly_income * 100.0) if monthly_income > 0 else 0.0
        ratio_pct = round(ratio_pct, 1)

        is_above_limit = ratio_pct > safe_limit_pct
        status = "above_limit" if is_above_limit else "within_limit"

        # 4. Determine Non-Verdict Message
        if is_above_limit:
            message = f"Current EMI burden is {ratio_pct}% of take-home income (above your preferred {safe_limit_pct}% limit)."
        else:
            message = f"Current EMI burden is {ratio_pct}% of take-home income (within your preferred {safe_limit_pct}% limit)."

        # 5. Fetch previous snapshot for Trend Comparison
        stmt_prev = (
            select(RiskSnapshot)
            .where(RiskSnapshot.user_id == user_id)
            .order_by(desc(RiskSnapshot.computed_at))
            .limit(1)
        )
        prev_snapshot = (await session.execute(stmt_prev)).scalar_one_or_none()

        if prev_snapshot:
            prev_ratio = float(prev_snapshot.emi_to_income_pct)
            trend_delta = round(ratio_pct - prev_ratio, 1)
            if trend_delta > 0.1:
                trend_direction = "up"
            elif trend_delta < -0.1:
                trend_direction = "down"
            else:
                trend_direction = "flat"
        else:
            trend_delta = 0.0
            trend_direction = "flat"

        # 6. Persist to RiskSnapshot if requested
        if persist_snapshot:
            risk_status = "over_limit" if is_above_limit else ("caution" if ratio_pct >= safe_limit_pct * 0.70 else "safe")
            snapshot = RiskSnapshot(
                user_id=user_id,
                total_emi=round(total_monthly_emi, 2),
                emi_to_income_pct=ratio_pct,
                risk_status=risk_status
            )
            session.add(snapshot)
            await session.flush()

        return {
            "monthly_income": monthly_income,
            "total_monthly_emi": round(total_monthly_emi, 2),
            "ratio_pct": ratio_pct,
            "safe_limit_pct": safe_limit_pct,
            "status": status,
            "is_above_limit": is_above_limit,
            "trend_delta_pct": trend_delta,
            "trend_direction": trend_direction,
            "message": message,
            "normalization_notes": normalization_notes if normalization_notes else None
        }


ratio_engine = RatioEngine()

from datetime import date, timedelta
from typing import Dict, Any, Optional, List
import calendar
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Loan, IncomeProfile, LoanSimulation, EmiSchedule
from app.services.ratio_engine import ratio_engine


class LoanSimulator:
    """
    New Loan Simulation Service ("What-if" Calculator) (§4.3):
    - Computes hypothetical before & after repayment burden and deltas
    - Evaluates calendar collision impact (e.g. falls inside existing or triggers new cluster)
    - Enforces non-verdict principle: strictly delivers numbers, deltas, and threshold flags
    - Does NOT persist as an active loan
    """

    async def simulate(
        self,
        session: AsyncSession,
        user_id: str,
        new_emi: float,
        duration_months: int,
        loan_amount: Optional[float] = None,
        preferred_due_day: Optional[int] = None,
        save_history: bool = True
    ) -> Dict[str, Any]:
        today = date.today()
        due_day = preferred_due_day or today.day

        # 1. Fetch Income Profile
        stmt_income = select(IncomeProfile).where(IncomeProfile.user_id == user_id)
        income_profile = (await session.execute(stmt_income)).scalar_one_or_none()

        monthly_income = float(income_profile.monthly_income) if income_profile else 0.0
        safe_ratio = float(income_profile.safe_emi_ratio) if income_profile else 0.40
        safe_limit_pct = round(safe_ratio * 100.0, 1)

        # 2. Fetch Current Active Loans
        stmt_loans = select(Loan).where(
            Loan.user_id == user_id,
            Loan.status == "active"
        )
        active_loans = (await session.execute(stmt_loans)).scalars().all()

        current_monthly_emi = 0.0
        for l in active_loans:
            norm_emi, _ = ratio_engine.normalize_to_monthly(float(l.emi_amount), l.repayment_frequency)
            current_monthly_emi += norm_emi

        # 3. Compute Ratios & Deltas
        combined_emi = current_monthly_emi + new_emi

        ratio_before = (current_monthly_emi / monthly_income * 100.0) if monthly_income > 0 else 0.0
        ratio_after = (combined_emi / monthly_income * 100.0) if monthly_income > 0 else 0.0

        ratio_before = round(ratio_before, 1)
        ratio_after = round(ratio_after, 1)
        delta_pp = round(ratio_after - ratio_before, 1)

        is_above_safe_limit = ratio_after > safe_limit_pct

        # 4. Evaluate Calendar Impact
        # Calculate simulated dates for next N months
        simulated_dates: List[date] = []
        cur_year = today.year
        cur_month = today.month

        for i in range(min(duration_months, 12)):  # check up to 12 months ahead
            target_month = cur_month + i
            target_year = cur_year + (target_month - 1) // 12
            target_month = ((target_month - 1) % 12) + 1

            _, max_days = calendar.monthrange(target_year, target_month)
            valid_day = min(due_day, max_days)
            sim_date = date(target_year, target_month, valid_day)
            simulated_dates.append(sim_date)

        # Check existing schedules around the first simulated due date (within 3 days before and after)
        first_sim_date = simulated_dates[0] if simulated_dates else today
        window_start = first_sim_date - timedelta(days=3)
        window_end = first_sim_date + timedelta(days=3)

        stmt_nearby = (
            select(EmiSchedule)
            .join(Loan, EmiSchedule.loan_id == Loan.id)
            .where(
                Loan.user_id == user_id,
                Loan.status == "active",
                EmiSchedule.due_date >= window_start,
                EmiSchedule.due_date <= window_end
            )
        )
        nearby_schedules = (await session.execute(stmt_nearby)).scalars().all()
        existing_cluster_total = sum(float(s.amount) for s in nearby_schedules)

        lands_in_concentration_window = len(nearby_schedules) >= 2 or existing_cluster_total > 5000
        creates_new_pressure = (existing_cluster_total + new_emi) > 10000 and len(nearby_schedules) >= 1

        if creates_new_pressure:
            impact_summary = f"Simulated EMI on day {due_day} adds to existing repayments around {first_sim_date.strftime('%d %b')}, bringing window total to ₹{existing_cluster_total + new_emi:,.0f}."
        elif lands_in_concentration_window:
            impact_summary = f"Due date on day {due_day} falls within an existing cluster of {len(nearby_schedules)} payments."
        else:
            impact_summary = f"Due date on day {due_day} is well-spaced from current active repayments."

        # 5. Optionally Persist to LoanSimulation (History)
        if save_history:
            sim_record = LoanSimulation(
                user_id=user_id,
                loan_amount=loan_amount,
                new_emi=new_emi,
                duration_months=duration_months,
                ratio_before=ratio_before,
                ratio_after=ratio_after
            )
            session.add(sim_record)
            await session.flush()

        return {
            "current_emi": round(current_monthly_emi, 2),
            "new_emi": round(new_emi, 2),
            "combined_emi": round(combined_emi, 2),
            "monthly_income": monthly_income,
            "ratio_before": ratio_before,
            "ratio_after": ratio_after,
            "delta_pp": delta_pp,
            "additional_monthly_commitment": round(new_emi, 2),
            "is_above_safe_limit": is_above_safe_limit,
            "safe_limit_pct": safe_limit_pct,
            "calendar_impact": {
                "simulated_due_day": due_day,
                "dates_added": simulated_dates,
                "lands_in_concentration_window": lands_in_concentration_window,
                "creates_new_pressure_window": creates_new_pressure,
                "impact_summary": impact_summary
            }
        }


loan_simulator = LoanSimulator()

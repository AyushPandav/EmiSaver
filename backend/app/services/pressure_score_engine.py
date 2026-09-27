from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from app.models import Loan, EmiSchedule, IncomeProfile, PressureWindow
from app.services.ratio_engine import ratio_engine


# Tunable weights for Payment Pressure Score (§4.4)
SCORE_WEIGHTS = {
    "concentration": 0.30,
    "burden": 0.25,
    "min_gap": 0.15,
    "pre_salary": 0.15,
    "active_loans": 0.10,
    "missed_payments": 0.05
}


class PressureScoreEngine:
    """
    Payment Pressure Score & Collision Risk Engine (§4.4):
    Computes composite pressure scores across rolling due-date windows
    and categorizes severity into 'info', 'caution', and 'high'.
    """

    def calculate_window_score(
        self,
        window_amount: float,
        total_monthly_emi: float,
        monthly_income: float,
        min_gap_days: int,
        is_pre_salary: bool,
        active_loan_count: int,
        missed_payment_count: int
    ) -> Tuple[float, str, Dict[str, Any]]:
        # 1. Concentration Ratio (Window EMI / Total Monthly EMI)
        concentration_ratio = (window_amount / total_monthly_emi) if total_monthly_emi > 0 else 0.0
        concentration_subscore = min(concentration_ratio / 0.60, 1.0)

        # 2. Burden Ratio (Total EMI / Income)
        burden_ratio = (total_monthly_emi / monthly_income) if monthly_income > 0 else 0.0
        burden_subscore = min(burden_ratio / 0.50, 1.0)

        # 3. Minimum gap between payments in window
        if min_gap_days <= 1:
            gap_subscore = 1.0
        elif min_gap_days == 2:
            gap_subscore = 0.7
        elif min_gap_days == 3:
            gap_subscore = 0.4
        else:
            gap_subscore = 0.1

        # 4. Proximity to Salary Date
        pre_salary_subscore = 1.0 if is_pre_salary else 0.2

        # 5. Number of Active Loans
        loan_count_subscore = min(active_loan_count / 5.0, 1.0)

        # 6. Missed Payments Count
        missed_subscore = min(missed_payment_count / 2.0, 1.0)

        # Weighted composite score (0 to 100)
        raw_score = (
            concentration_subscore * SCORE_WEIGHTS["concentration"] +
            burden_subscore * SCORE_WEIGHTS["burden"] +
            gap_subscore * SCORE_WEIGHTS["min_gap"] +
            pre_salary_subscore * SCORE_WEIGHTS["pre_salary"] +
            loan_count_subscore * SCORE_WEIGHTS["active_loans"] +
            missed_subscore * SCORE_WEIGHTS["missed_payments"]
        ) * 100.0

        pressure_score = round(min(max(raw_score, 0.0), 100.0), 1)

        # Severity categorization (<40 = info, 40-70 = caution, >70 = high)
        if pressure_score > 70.0:
            severity = "high"
        elif pressure_score >= 40.0:
            severity = "caution"
        else:
            severity = "info"

        factors = {
            "concentration_ratio": round(concentration_ratio, 2),
            "burden_ratio": round(burden_ratio, 2),
            "min_gap_days": min_gap_days,
            "pre_salary": is_pre_salary,
            "active_loan_count": active_loan_count,
            "missed_payment_count": missed_payment_count,
            "weights_used": SCORE_WEIGHTS
        }

        return pressure_score, severity, factors

    async def detect_and_save_windows(
        self,
        session: AsyncSession,
        user_id: str,
        lookahead_days: int = 60
    ) -> List[Dict[str, Any]]:
        today = date.today()
        horizon_end = today + timedelta(days=lookahead_days)

        # 1. Fetch User Profile & Context
        stmt_income = select(IncomeProfile).where(IncomeProfile.user_id == user_id)
        income_profile = (await session.execute(stmt_income)).scalar_one_or_none()
        monthly_income = float(income_profile.monthly_income) if income_profile else 0.0
        salary_day = income_profile.salary_date if income_profile and income_profile.salary_date else 1

        # Active loans count & normalized total EMI
        stmt_loans = select(Loan).where(Loan.user_id == user_id, Loan.status == "active")
        active_loans = (await session.execute(stmt_loans)).scalars().all()
        active_loan_count = len(active_loans)

        total_monthly_emi = 0.0
        for l in active_loans:
            norm_emi, _ = ratio_engine.normalize_to_monthly(float(l.emi_amount), l.repayment_frequency)
            total_monthly_emi += norm_emi

        # Count missed past payments
        stmt_missed = select(EmiSchedule).join(Loan).where(
            Loan.user_id == user_id,
            EmiSchedule.paid == False,
            EmiSchedule.due_date < today
        )
        missed_payments = (await session.execute(stmt_missed)).scalars().all()
        missed_payment_count = len(missed_payments)

        # Fetch upcoming repayments in the lookahead period
        stmt_sched = (
            select(EmiSchedule, Loan)
            .join(Loan, EmiSchedule.loan_id == Loan.id)
            .where(
                Loan.user_id == user_id,
                Loan.status == "active",
                EmiSchedule.due_date >= today,
                EmiSchedule.due_date <= horizon_end
            )
            .order_by(EmiSchedule.due_date.asc())
        )
        schedules = (await session.execute(stmt_sched)).all()

        if not schedules:
            return []

        # 2. Cluster Due Dates into Windows (clustering if gap <= 3 days)
        clusters: List[List[Tuple[EmiSchedule, Loan]]] = []
        current_cluster: List[Tuple[EmiSchedule, Loan]] = [schedules[0]]

        for entry in schedules[1:]:
            prev_entry = current_cluster[-1]
            gap = (entry[0].due_date - prev_entry[0].due_date).days
            if gap <= 3:
                current_cluster.append(entry)
            else:
                clusters.append(current_cluster)
                current_cluster = [entry]
        if current_cluster:
            clusters.append(current_cluster)

        # 3. Clean old computed windows for this user
        await session.execute(delete(PressureWindow).where(PressureWindow.user_id == user_id))

        # 4. Evaluate each cluster
        detected_windows: List[Dict[str, Any]] = []

        for cluster in clusters:
            window_start = cluster[0][0].due_date
            window_end = cluster[-1][0].due_date
            total_due = sum(float(item[0].amount) for item in cluster)

            # Minimum gap between consecutive repayments in cluster
            min_gap = 7
            if len(cluster) > 1:
                gaps = [(cluster[i][0].due_date - cluster[i-1][0].due_date).days for i in range(1, len(cluster))]
                min_gap = min(gaps)
            else:
                min_gap = 7

            # Pre-salary check: falls within 7 days BEFORE salary day of the month
            # E.g. if salary is on the 1st, days 24-31 are pre-salary
            cluster_mid_day = window_start.day
            if salary_day >= 7:
                is_pre_salary = (salary_day - 7) <= cluster_mid_day < salary_day
            else:
                # E.g., salary on 1st -> pre-salary is days >= 24 or < 1
                is_pre_salary = cluster_mid_day >= (30 - 7 + salary_day) or cluster_mid_day < salary_day

            score, severity, factors = self.calculate_window_score(
                window_amount=total_due,
                total_monthly_emi=total_monthly_emi,
                monthly_income=monthly_income,
                min_gap_days=min_gap,
                is_pre_salary=is_pre_salary,
                active_loan_count=active_loan_count,
                missed_payment_count=missed_payment_count
            )

            # Only save windows with total_due > 0 and interesting cluster/pressure
            pw = PressureWindow(
                user_id=user_id,
                window_start=window_start,
                window_end=window_end,
                total_due=round(total_due, 2),
                pressure_score=score,
                severity=severity,
                contributing_factors=factors
            )
            session.add(pw)
            await session.flush()

            detected_windows.append({
                "id": pw.id,
                "window_start": window_start,
                "window_end": window_end,
                "total_due": round(total_due, 2),
                "pressure_score": score,
                "severity": severity,
                "contributing_factors": factors,
                "computed_at": pw.computed_at
            })

        return detected_windows


pressure_score_engine = PressureScoreEngine()

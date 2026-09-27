from datetime import date, datetime, timedelta
import calendar
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models import Loan, EmiSchedule


class CalendarService:
    """
    Unified Repayment Calendar Aggregation Service (§4.1):
    Aggregates emi_schedule across all loans into day-bucketed structures
    with month totals, next month totals, and busiest week indicators.
    """

    async def get_unified_calendar(
        self,
        session: AsyncSession,
        user_id: str,
        target_year: Optional[int] = None,
        target_month: Optional[int] = None
    ) -> Dict[str, Any]:
        today = date.today()
        year = target_year or today.year
        month = target_month or today.month

        # Month boundaries for target month
        _, num_days = calendar.monthrange(year, month)
        month_start = date(year, month, 1)
        month_end = date(year, month, num_days)

        # Boundaries for next month
        if month == 12:
            next_year = year + 1
            next_month = 1
        else:
            next_year = year
            next_month = month + 1
        _, next_num_days = calendar.monthrange(next_year, next_month)
        next_month_start = date(next_year, next_month, 1)
        next_month_end = date(next_year, next_month, next_num_days)

        # Fetch all schedule entries for target and next month for the user's active loans
        stmt = (
            select(EmiSchedule, Loan)
            .join(Loan, EmiSchedule.loan_id == Loan.id)
            .where(
                Loan.user_id == user_id,
                Loan.status == "active",
                EmiSchedule.due_date >= month_start,
                EmiSchedule.due_date <= next_month_end
            )
            .order_by(EmiSchedule.due_date.asc())
        )
        results = (await session.execute(stmt)).all()

        # Group entries by due_date
        entries_by_date: Dict[date, List[Dict[str, Any]]] = {}
        this_month_total = 0.0
        next_month_total = 0.0

        for schedule, loan in results:
            d = schedule.due_date
            amt = float(schedule.amount)

            if month_start <= d <= month_end:
                this_month_total += amt
                if d not in entries_by_date:
                    entries_by_date[d] = []
                entries_by_date[d].append({
                    "loan_id": loan.id,
                    "lender": loan.lender,
                    "loan_identifier": loan.loan_identifier,
                    "amount": round(amt, 2),
                    "paid": schedule.paid
                })
            elif next_month_start <= d <= next_month_end:
                next_month_total += amt

        # Build day-bucketed list for target month
        days_list: List[Dict[str, Any]] = []
        for day_num in range(1, num_days + 1):
            curr_date = date(year, month, day_num)
            day_items = entries_by_date.get(curr_date, [])
            day_total = sum(item["amount"] for item in day_items)

            days_list.append({
                "date": curr_date,
                "day_of_month": day_num,
                "day_of_week": curr_date.strftime("%a"),
                "total_amount": round(day_total, 2),
                "items": day_items,
                "is_past": curr_date < today
            })

        # Calculate Busiest Week (rolling 7-day window within the month)
        busiest_week = None
        max_week_amt = 0.0
        busiest_start = None
        busiest_count = 0

        for day_num in range(1, num_days - 6 + 1):
            w_start = date(year, month, day_num)
            w_end = date(year, month, day_num + 6)
            window_amt = 0.0
            window_count = 0

            for offset in range(7):
                check_d = date(year, month, day_num + offset)
                items = entries_by_date.get(check_d, [])
                window_amt += sum(i["amount"] for i in items)
                window_count += len(items)

            if window_amt > max_week_amt:
                max_week_amt = window_amt
                busiest_start = w_start
                busiest_count = window_count

        if busiest_start and max_week_amt > 0:
            busiest_week = {
                "start_date": busiest_start,
                "end_date": busiest_start + timedelta(days=6),
                "total_amount": round(max_week_amt, 2),
                "installment_count": busiest_count
            }

        return {
            "month": month,
            "year": year,
            "days": days_list,
            "this_month_total": round(this_month_total, 2),
            "next_month_total": round(next_month_total, 2),
            "busiest_week": busiest_week
        }


calendar_service = CalendarService()

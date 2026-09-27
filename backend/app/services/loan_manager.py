from typing import List, Optional, Dict, Any
from datetime import date, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, desc
from app.models import Loan, EmiSchedule, UserCorrection, ParsedLoanEvent
from app.schemas import LoanUpdate, LoanMergeRequest
from app.services.risk_calculator import risk_calculator


class LoanManager:
    """
    Manages CRUD, merging, false-positive classification, and user corrections for canonical loans.
    """

    async def get_user_loans(self, session: AsyncSession, user_id: str, status: str = "active") -> List[Dict[str, Any]]:
        stmt = (
            select(Loan)
            .where(Loan.user_id == user_id, Loan.status == status)
            .order_by(desc(Loan.updated_at))
        )
        loans = (await session.execute(stmt)).scalars().all()

        loan_responses = []
        for loan in loans:
            # Find next upcoming due date
            sched_stmt = (
                select(EmiSchedule.due_date)
                .where(
                    EmiSchedule.loan_id == loan.id,
                    EmiSchedule.due_date >= date.today(),
                    EmiSchedule.paid == False
                )
                .order_by(EmiSchedule.due_date.asc())
                .limit(1)
            )
            next_date = (await session.execute(sched_stmt)).scalar_one_or_none()

            loan_dict = {
                "id": loan.id,
                "user_id": loan.user_id,
                "lender": loan.lender,
                "loan_identifier": loan.loan_identifier,
                "principal_amount": float(loan.principal_amount) if loan.principal_amount else None,
                "emi_amount": float(loan.emi_amount),
                "repayment_frequency": loan.repayment_frequency,
                "status": loan.status,
                "source_confidence": float(loan.source_confidence) if loan.source_confidence else None,
                "manually_verified": loan.manually_verified,
                "next_due_date": next_date,
                "created_at": loan.created_at,
                "updated_at": loan.updated_at
            }
            loan_responses.append(loan_dict)
        return loan_responses

    async def update_loan(
        self,
        session: AsyncSession,
        user_id: str,
        loan_id: str,
        updates: LoanUpdate
    ) -> Optional[Dict[str, Any]]:
        stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == user_id)
        loan = (await session.execute(stmt)).scalar_one_or_none()
        if not loan:
            return None

        before_state = {
            "lender": loan.lender,
            "emi_amount": float(loan.emi_amount),
            "loan_identifier": loan.loan_identifier,
            "status": loan.status
        }

        # Apply updates
        if updates.lender is not None:
            loan.lender = updates.lender
        if updates.loan_identifier is not None:
            loan.loan_identifier = updates.loan_identifier
        if updates.emi_amount is not None:
            loan.emi_amount = updates.emi_amount
        if updates.principal_amount is not None:
            loan.principal_amount = updates.principal_amount
        if updates.repayment_frequency is not None:
            loan.repayment_frequency = updates.repayment_frequency
        if updates.status is not None:
            loan.status = updates.status

        loan.manually_verified = True
        loan.updated_at = datetime.utcnow()

        # If next_due_date is provided, update or create future schedule
        if updates.next_due_date:
            sched_stmt = select(EmiSchedule).where(
                EmiSchedule.loan_id == loan.id,
                EmiSchedule.paid == False
            ).order_by(EmiSchedule.due_date.asc()).limit(1)
            curr_sched = (await session.execute(sched_stmt)).scalar_one_or_none()
            if curr_sched:
                curr_sched.due_date = updates.next_due_date
                if updates.emi_amount:
                    curr_sched.amount = updates.emi_amount
            else:
                new_sched = EmiSchedule(
                    loan_id=loan.id,
                    due_date=updates.next_due_date,
                    amount=float(loan.emi_amount),
                    paid=False
                )
                session.add(new_sched)

        after_state = {
            "lender": loan.lender,
            "emi_amount": float(loan.emi_amount),
            "loan_identifier": loan.loan_identifier,
            "status": loan.status
        }

        # Record UserCorrection feedback row
        correction = UserCorrection(
            user_id=user_id,
            loan_id=loan.id,
            correction_type="edit",
            before_value=before_state,
            after_value=after_state
        )
        session.add(correction)

        # Recompute risk snapshot
        await risk_calculator.compute_and_save_snapshot(session, user_id)
        await session.commit()

        # Re-fetch loan
        return (await self.get_user_loans(session, user_id, status=loan.status))[0]

    async def merge_loans(
        self,
        session: AsyncSession,
        user_id: str,
        primary_loan_id: str,
        secondary_loan_id: str
    ) -> Optional[Loan]:
        stmt1 = select(Loan).where(Loan.id == primary_loan_id, Loan.user_id == user_id)
        stmt2 = select(Loan).where(Loan.id == secondary_loan_id, Loan.user_id == user_id)

        primary = (await session.execute(stmt1)).scalar_one_or_none()
        secondary = (await session.execute(stmt2)).scalar_one_or_none()

        if not primary or not secondary:
            return None

        # Transfer schedules and events from secondary to primary
        await session.execute(
            update(EmiSchedule)
            .where(EmiSchedule.loan_id == secondary.id)
            .values(loan_id=primary.id)
        )
        await session.execute(
            update(ParsedLoanEvent)
            .where(ParsedLoanEvent.matched_loan_id == secondary.id)
            .values(matched_loan_id=primary.id)
        )

        # Log correction
        correction = UserCorrection(
            user_id=user_id,
            loan_id=primary.id,
            correction_type="merge",
            before_value={"merged_loan_id": secondary.id, "secondary_lender": secondary.lender},
            after_value={"primary_loan_id": primary.id, "primary_lender": primary.lender}
        )
        session.add(correction)

        # Delete secondary loan
        await session.delete(secondary)

        primary.manually_verified = True
        primary.updated_at = datetime.utcnow()

        await risk_calculator.compute_and_save_snapshot(session, user_id)
        await session.commit()
        return primary

    async def mark_not_loan(
        self,
        session: AsyncSession,
        user_id: str,
        loan_id: str
    ) -> bool:
        stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == user_id)
        loan = (await session.execute(stmt)).scalar_one_or_none()
        if not loan:
            return False

        # Mark status as disputed / not a loan
        loan.status = "disputed"
        loan.manually_verified = True
        loan.updated_at = datetime.utcnow()

        # Log correction
        correction = UserCorrection(
            user_id=user_id,
            loan_id=loan.id,
            correction_type="mark_not_loan",
            before_value={"status": "active", "lender": loan.lender, "amount": float(loan.emi_amount)},
            after_value={"status": "disputed"}
        )
        session.add(correction)

        await risk_calculator.compute_and_save_snapshot(session, user_id)
        await session.commit()
        return True

    async def get_upcoming_calendar(
        self,
        session: AsyncSession,
        user_id: str,
        from_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        ref_date = from_date or date.today()
        stmt = (
            select(EmiSchedule, Loan)
            .join(Loan, EmiSchedule.loan_id == Loan.id)
            .where(
                Loan.user_id == user_id,
                Loan.status == "active",
                EmiSchedule.due_date >= ref_date
            )
            .order_by(EmiSchedule.due_date.asc())
        )
        rows = (await session.execute(stmt)).all()

        calendar_entries = []
        for sched, loan in rows:
            calendar_entries.append({
                "id": sched.id,
                "loan_id": loan.id,
                "lender": loan.lender,
                "due_date": sched.due_date,
                "amount": float(sched.amount),
                "paid": sched.paid,
                "loan_identifier": loan.loan_identifier
            })
        return calendar_entries


loan_manager = LoanManager()

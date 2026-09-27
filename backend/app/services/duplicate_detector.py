import json
from datetime import date, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from app.models import Loan, ParsedLoanEvent, EmiSchedule, UserCorrection


class DuplicateDetector:
    """
    Detects and merges duplicate loan events across multiple messages into a single canonical Loan.
    Follows §6.4 and §8 specifications.
    """

    async def find_matching_loan(
        self,
        session: AsyncSession,
        user_id: str,
        lender: str,
        loan_identifier: Optional[str],
        emi_amount: Optional[float],
        principal_amount: Optional[float],
        due_date: Optional[date]
    ) -> Optional[Loan]:
        if not lender:
            return None

        # Fetch existing loans for this user with same lender
        stmt = select(Loan).where(
            Loan.user_id == user_id,
            Loan.lender.ilike(f"%{lender}%"),
            Loan.status == "active"
        )
        result = await session.execute(stmt)
        candidate_loans = result.scalars().all()

        if not candidate_loans:
            return None

        # Rule 1: Exact match on (lender, loan_identifier)
        if loan_identifier:
            for loan in candidate_loans:
                if loan.loan_identifier and loan.loan_identifier.upper() == loan_identifier.upper():
                    return loan

        # Rule 2: Match on (lender, emi_amount)
        if emi_amount and emi_amount > 0:
            for loan in candidate_loans:
                if loan.emi_amount and abs(float(loan.emi_amount) - emi_amount) < 1.0:
                    return loan

        # Rule 3: Loan approved -> EMI generated (Matching by lender where loan only had principal)
        if principal_amount and principal_amount > 0:
            for loan in candidate_loans:
                if loan.principal_amount and abs(float(loan.principal_amount) - principal_amount) < 1.0:
                    return loan

        # Rule 4: If single active loan for this lender, associate it
        if len(candidate_loans) == 1:
            return candidate_loans[0]

        return None

    async def merge_or_create_loan(
        self,
        session: AsyncSession,
        user_id: str,
        parsed_event_data: Dict[str, Any],
        raw_message_id: Optional[str] = None
    ) -> Tuple[Loan, ParsedLoanEvent]:
        lender = parsed_event_data.get("lender") or "Unknown Lender"
        loan_identifier = parsed_event_data.get("loan_identifier")
        loan_amount = parsed_event_data.get("loan_amount")
        emi_amount = parsed_event_data.get("emi_amount")
        due_date = parsed_event_data.get("due_date")
        frequency = parsed_event_data.get("repayment_frequency", "monthly")
        confidence = parsed_event_data.get("confidence", 0.70)
        message_type = parsed_event_data.get("message_type")
        lang = parsed_event_data.get("language_detected", "en")
        needs_review = parsed_event_data.get("needs_review", False)

        # 1. Look for existing matched loan
        matched_loan = await self.find_matching_loan(
            session=session,
            user_id=user_id,
            lender=lender,
            loan_identifier=loan_identifier,
            emi_amount=emi_amount,
            principal_amount=loan_amount,
            due_date=due_date
        )

        # 2. Update existing loan or create new loan
        if matched_loan:
            # Update fields if new event provides more specific information
            if loan_identifier and not matched_loan.loan_identifier:
                matched_loan.loan_identifier = loan_identifier
            if emi_amount and emi_amount > 0:
                matched_loan.emi_amount = emi_amount
            if loan_amount and loan_amount > 0 and not matched_loan.principal_amount:
                matched_loan.principal_amount = loan_amount
            if confidence and (not matched_loan.source_confidence or confidence > float(matched_loan.source_confidence)):
                matched_loan.source_confidence = confidence

            loan = matched_loan
        else:
            # Create canonical loan
            effective_emi = emi_amount if (emi_amount and emi_amount > 0) else (loan_amount or 0.0)
            loan = Loan(
                user_id=user_id,
                lender=lender,
                loan_identifier=loan_identifier,
                principal_amount=loan_amount,
                emi_amount=effective_emi,
                repayment_frequency=frequency,
                status="active",
                source_confidence=confidence,
                manually_verified=False
            )
            session.add(loan)
            await session.flush()

        field_confidence = parsed_event_data.get("field_confidence")
        local_message_ref = parsed_event_data.get("local_message_ref")

        # 3. Create ParsedLoanEvent row
        event = ParsedLoanEvent(
            raw_message_id=raw_message_id,
            user_id=user_id,
            lender=lender,
            loan_identifier=loan_identifier,
            loan_amount=loan_amount,
            emi_amount=emi_amount,
            due_date=due_date,
            repayment_frequency=frequency,
            message_type=message_type,
            language_detected=lang,
            confidence=confidence,
            field_confidence=field_confidence,
            local_message_ref=local_message_ref,
            needs_review=needs_review,
            matched_loan_id=loan.id
        )
        session.add(event)
        await session.flush()

        # 4. Schedule management if due date is present
        if due_date and (emi_amount or loan.emi_amount):
            sched_amount = emi_amount if (emi_amount and emi_amount > 0) else float(loan.emi_amount)
            # Check if schedule for this date & loan already exists
            sched_stmt = select(EmiSchedule).where(
                EmiSchedule.loan_id == loan.id,
                EmiSchedule.due_date == due_date
            )
            existing_sched = (await session.execute(sched_stmt)).scalar_one_or_none()

            if not existing_sched:
                schedule = EmiSchedule(
                    loan_id=loan.id,
                    due_date=due_date,
                    amount=sched_amount,
                    paid=(message_type == "payment_confirmed"),
                    source_event_id=event.id
                )
                session.add(schedule)
            elif message_type == "payment_confirmed":
                existing_sched.paid = True

        return loan, event


duplicate_detector = DuplicateDetector()

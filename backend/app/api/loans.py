from typing import List, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User, Loan, ParsedLoanEvent, EmiSchedule
from app.schemas import (
    LoanResponse, LoanUpdate, LoanMergeRequest,
    StructuredIngestRequest, StructuredIngestResponse,
    LoanTimelineResponse, LoanTimelineNode
)
from app.api.deps import get_current_user
from app.services.loan_manager import loan_manager
from app.services.duplicate_detector import duplicate_detector
from app.services.risk_calculator import risk_calculator

router = APIRouter(prefix="/loans", tags=["Loans & Manual Corrections"])


@router.post("/structured-ingest", response_model=StructuredIngestResponse)
async def structured_ingest(
    payload: StructuredIngestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Phase 3 Primary Ingestion Path:
    Accepts already-structured on-device extracted fields with per-field confidence.
    Zero raw text is received or stored.
    """
    processed_count = 0
    loans_updated = 0
    new_events_count = 0
    low_confidence_refs = []

    for item in payload.items:
        # Evaluate conservative per-field threshold (default 0.75)
        conf = item.confidence
        min_field_conf = min(conf.lender, conf.emi, conf.due_date)
        needs_review = min_field_conf < 0.75

        if needs_review and item.local_message_ref:
            low_confidence_refs.append(item.local_message_ref)

        parsed_event_data = {
            "lender": item.lender or "Unknown Lender",
            "loan_identifier": item.loan_identifier,
            "loan_amount": item.emi,  # fallback if principal not set
            "emi_amount": item.emi,
            "due_date": item.due_date,
            "repayment_frequency": "monthly",
            "message_type": item.message_type or "emi_reminder",
            "language_detected": "on-device",
            "confidence": conf.overall,
            "field_confidence": {
                "lender": conf.lender,
                "emi": conf.emi,
                "due_date": conf.due_date,
                "overall": conf.overall,
            },
            "local_message_ref": item.local_message_ref,
            "needs_review": needs_review,
        }

        loan, event = await duplicate_detector.merge_or_create_loan(
            session=db,
            user_id=current_user.id,
            parsed_event_data=parsed_event_data,
            raw_message_id=None
        )

        processed_count += 1
        new_events_count += 1
        loans_updated += 1

    # Recalculate user risk snapshot
    await risk_calculator.compute_and_save_snapshot(db, current_user.id)
    await db.commit()

    return StructuredIngestResponse(
        total_received=len(payload.items),
        processed_count=processed_count,
        loans_updated=loans_updated,
        new_events_count=new_events_count,
        low_confidence_refs=low_confidence_refs,
        message="Structured on-device records ingested successfully without raw text storage"
    )


@router.get("/{loan_id}/timeline", response_model=LoanTimelineResponse)
async def get_loan_timeline(
    loan_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Phase 3 Loan Timeline Reconstruction:
    Turns matched parsed_loan_events into a human-readable chronological story,
    plus projected upcoming installments with visual indicators.
    """
    loan_stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    loan = (await db.execute(loan_stmt)).scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    events_stmt = select(ParsedLoanEvent).where(
        ParsedLoanEvent.matched_loan_id == loan_id
    ).order_by(ParsedLoanEvent.created_at.asc())
    events = (await db.execute(events_stmt)).scalars().all()

    timeline_nodes: List[LoanTimelineNode] = []

    type_to_title = {
        "loan_approved": "Loan Approved",
        "loan_disbursed": "Loan Disbursed",
        "emi_generated": "EMI Bill Generated",
        "emi_reminder": "EMI Due Reminder",
        "payment_confirmed": "Payment Received",
        "overdue_notice": "Overdue Notice",
    }

    latest_date = None

    for ev in events:
        node_date = ev.due_date or (ev.created_at.date() if ev.created_at else date.today())
        if not latest_date or node_date > latest_date:
            latest_date = node_date

        m_type = ev.message_type or "emi_reminder"
        title = type_to_title.get(m_type, "EMI Event")
        amt = float(ev.emi_amount) if ev.emi_amount else (float(ev.loan_amount) if ev.loan_amount else None)

        timeline_nodes.append(LoanTimelineNode(
            event_id=ev.id,
            event_date=node_date,
            title=title,
            description=f"Status: {m_type.replace('_', ' ').title()}",
            node_type=m_type,
            amount=amt,
            confidence=float(ev.confidence) if ev.confidence else None,
            is_projected=False
        ))

    # Add next projected EMI if loan is active
    if loan.status == "active":
        base_date = latest_date or date.today()
        # project +1 month
        projected_date = base_date + timedelta(days=30)
        timeline_nodes.append(LoanTimelineNode(
            event_id=None,
            event_date=projected_date,
            title="Next EMI (projected)",
            description=f"Scheduled {loan.repayment_frequency} installment for {loan.lender}",
            node_type="projected",
            amount=float(loan.emi_amount) if loan.emi_amount else None,
            confidence=1.0,
            is_projected=True
        ))

    return LoanTimelineResponse(
        loan_id=loan.id,
        lender=loan.lender,
        loan_identifier=loan.loan_identifier,
        status=loan.status,
        total_events=len(timeline_nodes),
        timeline=timeline_nodes
    )



@router.get("", response_model=List[LoanResponse])
async def list_loans(
    status: str = "active",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return all canonical loans for current user with next due date."""
    return await loan_manager.get_user_loans(db, current_user.id, status=status)


@router.patch("/{loan_id}", response_model=LoanResponse)
async def update_loan(
    loan_id: str,
    payload: LoanUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Manual correction of a loan record (lender, amount, due date, etc.).
    Records user correction feedback loop and updates risk snapshot.
    """
    updated = await loan_manager.update_loan(db, current_user.id, loan_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Loan not found")
    return updated


@router.post("/{loan_id}/merge", response_model=LoanResponse)
async def merge_loans(
    loan_id: str,
    payload: LoanMergeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Merge secondary loan into primary loan.
    Reassigns all schedules and events, logs correction feedback, and recalculates risk.
    """
    merged_loan = await loan_manager.merge_loans(
        session=db,
        user_id=current_user.id,
        primary_loan_id=loan_id,
        secondary_loan_id=payload.merge_with_loan_id
    )
    if not merged_loan:
        raise HTTPException(status_code=404, detail="One or both loans not found")

    loans = await loan_manager.get_user_loans(db, current_user.id, status=merged_loan.status)
    matched = next((l for l in loans if l["id"] == loan_id), None)
    return matched or loans[0]


@router.post("/{loan_id}/mark-not-loan")
async def mark_not_loan(
    loan_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Reclassify a false positive: marks loan status as disputed / not a loan.
    Removes it from active EMI totals and updates risk snapshot.
    """
    success = await loan_manager.mark_not_loan(db, current_user.id, loan_id)
    if not success:
        raise HTTPException(status_code=404, detail="Loan not found")
    return {"status": "success", "message": "Loan marked as not a loan and excluded from totals"}

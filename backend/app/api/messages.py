from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models import User, RawMessage, ParsedLoanEvent
from app.schemas import MessageIngestRequest, IngestResponse, ParsedEventResponse, FallbackParseRequest
from app.api.deps import get_current_user
from app.services.nlp import nlp_pipeline
from app.services.duplicate_detector import duplicate_detector
from app.services.risk_calculator import risk_calculator

router = APIRouter(prefix="/messages", tags=["Messages & Ingestion"])


@router.post("/fallback-parse", response_model=ParsedEventResponse)
async def fallback_parse_message(
    payload: FallbackParseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Phase 3 Repurposed NLP Pipeline:
    Opt-in only fallback parse endpoint when on-device confidence was very low
    and the user explicitly tapped 'Let us help parse this one'.
    Carries an explicit retention expiration timestamp.
    """
    if not payload.user_consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Explicit user consent is mandatory to transmit raw text for backend fallback parsing."
        )

    retention_expiry = datetime.utcnow() + timedelta(days=payload.retention_days)

    raw_msg = RawMessage(
        user_id=current_user.id,
        source=payload.source,
        sender=payload.sender,
        raw_text=payload.raw_text,
        received_at=datetime.utcnow(),
        processed=False,
        opt_in_fallback=True,
        retention_expires_at=retention_expiry
    )
    db.add(raw_msg)
    await db.flush()

    parsed_result = nlp_pipeline.process_message(
        raw_text=payload.raw_text,
        sender=payload.sender,
        source_message_id=raw_msg.id
    )

    if not parsed_result.get("is_loan_related"):
        await db.commit()
        return ParsedEventResponse(
            id=raw_msg.id,
            lender=None,
            loan_identifier=None,
            loan_amount=None,
            emi_amount=None,
            due_date=None,
            repayment_frequency="monthly",
            message_type="not_loan_related",
            confidence=0.0,
            needs_review=True,
            language_detected="en",
            matched_loan_id=None
        )

    parsed_result["local_message_ref"] = payload.local_message_ref
    loan, event = await duplicate_detector.merge_or_create_loan(
        session=db,
        user_id=current_user.id,
        parsed_event_data=parsed_result,
        raw_message_id=raw_msg.id
    )
    raw_msg.processed = True

    await risk_calculator.compute_and_save_snapshot(db, current_user.id)
    await db.commit()

    return ParsedEventResponse(
        id=event.id,
        lender=event.lender,
        loan_identifier=event.loan_identifier,
        loan_amount=float(event.loan_amount) if event.loan_amount else None,
        emi_amount=float(event.emi_amount) if event.emi_amount else None,
        due_date=event.due_date,
        repayment_frequency=event.repayment_frequency,
        message_type=event.message_type,
        confidence=float(event.confidence) if event.confidence else 0.70,
        needs_review=event.needs_review,
        language_detected=event.language_detected,
        matched_loan_id=loan.id
    )



@router.post("/ingest", response_model=IngestResponse)
async def ingest_messages(
    payload: MessageIngestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepts batch of filtered raw messages from mobile client.
    Passes each through 7-stage NLP normalization and duplicate detection engine.
    Updates canonical loans and recalculates risk snapshot.
    """
    new_events: List[ParsedEventResponse] = []
    loans_updated_count = 0

    for msg_item in payload.messages:
        # 1. Save RawMessage
        raw_msg = RawMessage(
            user_id=current_user.id,
            source=msg_item.source,
            sender=msg_item.sender,
            raw_text=msg_item.raw_text,
            received_at=msg_item.received_at,
            processed=False
        )
        db.add(raw_msg)
        await db.flush()

        # 2. Run NLP Extraction Pipeline
        parsed_result = nlp_pipeline.process_message(
            raw_text=msg_item.raw_text,
            sender=msg_item.sender,
            source_message_id=raw_msg.id,
            reference_date=msg_item.received_at.date() if msg_item.received_at else None
        )

        # 3. If loan related, run duplicate detection / loan merging
        if parsed_result.get("is_loan_related"):
            loan, event = await duplicate_detector.merge_or_create_loan(
                session=db,
                user_id=current_user.id,
                parsed_event_data=parsed_result,
                raw_message_id=raw_msg.id
            )
            raw_msg.processed = True
            loans_updated_count += 1

            new_events.append(
                ParsedEventResponse(
                    id=event.id,
                    lender=event.lender,
                    loan_identifier=event.loan_identifier,
                    loan_amount=float(event.loan_amount) if event.loan_amount else None,
                    emi_amount=float(event.emi_amount) if event.emi_amount else None,
                    due_date=event.due_date,
                    repayment_frequency=event.repayment_frequency,
                    message_type=event.message_type,
                    language_detected=event.language_detected,
                    confidence=float(event.confidence) if event.confidence else None,
                    needs_review=event.needs_review,
                    matched_loan_id=loan.id
                )
            )

    # 4. Recompute Risk Snapshot
    await risk_calculator.compute_and_save_snapshot(db, current_user.id)
    await db.commit()

    return IngestResponse(
        total_received=len(payload.messages),
        processed_count=len(new_events),
        new_events=new_events,
        loans_updated=loans_updated_count,
        message=f"Successfully processed {len(new_events)} loan events."
    )


@router.delete("/{message_id}", status_code=status.HTTP_200_OK)
async def delete_raw_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Privacy control: User-initiated deletion of raw source message.
    Removes raw message content from database permanently.
    """
    stmt = select(RawMessage).where(
        RawMessage.id == message_id,
        RawMessage.user_id == current_user.id
    )
    raw_msg = (await db.execute(stmt)).scalar_one_or_none()
    if not raw_msg:
        raise HTTPException(status_code=404, detail="Message not found")

    await db.delete(raw_msg)
    await db.commit()
    return {"status": "deleted", "message_id": message_id}

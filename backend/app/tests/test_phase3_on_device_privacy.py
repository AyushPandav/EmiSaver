import pytest
import os
import json
from datetime import date, datetime, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User, RawMessage, ParsedLoanEvent, Loan, EmiSchedule, IncomeProfile
from app.services.nlp.lender_lookup import LenderLookup


@pytest.mark.asyncio
async def test_shared_ruleset_loading():
    """Verify shared/ruleset.json is accessible and valid for the Python engine."""
    lookup = LenderLookup()
    assert len(lookup.lenders) >= 8
    # Test lookup using ruleset
    name, conf = lookup.identify_lender("VM-LAZYPY", "Your LazyPay EMI is due")
    assert name == "LazyPay"
    assert conf >= 0.95


@pytest.mark.asyncio
async def test_structured_ingest_no_raw_text(client: AsyncClient, db_session: AsyncSession):
    """
    Phase 3 Core Architecture:
    Ingest pre-structured fields from on-device parser.
    Verify NO raw_messages row is created and loans/schedules are populated.
    """
    # 1. Create test user
    user_res = await client.post("/api/v1/users", json={"device_id": "test-device-phase3-1"})
    assert user_res.status_code in [200, 201]
    user_data = user_res.json()
    user_id = user_data["id"]

    headers = {"X-Device-Id": "test-device-phase3-1", "X-User-Id": user_id}

    # 2. Call /loans/structured-ingest
    payload = {
        "items": [
            {
                "lender": "KreditBee",
                "emi": 3200.0,
                "due_date": "2026-10-15",
                "message_type": "emi_reminder",
                "loan_identifier": "KB9876",
                "confidence": {
                    "lender": 0.95,
                    "emi": 0.98,
                    "due_date": 0.92,
                    "overall": 0.92
                },
                "local_message_ref": "local-msg-uuid-1"
            }
        ]
    }

    res = await client.post("/api/v1/loans/structured-ingest", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["processed_count"] == 1
    assert data["loans_updated"] == 1
    assert len(data["low_confidence_refs"]) == 0

    # 3. Verify zero rows in raw_messages
    raw_count = (await db_session.execute(select(RawMessage).where(RawMessage.user_id == user_id))).scalars().all()
    assert len(raw_count) == 0, "No raw messages should be written during structured ingest"

    # 4. Verify loan was created
    loan_res = await client.get("/api/v1/loans", headers=headers)
    assert loan_res.status_code == 200
    loans = loan_res.json()
    assert len(loans) == 1
    assert loans[0]["lender"] == "KreditBee"
    assert loans[0]["emi_amount"] == 3200.0


@pytest.mark.asyncio
async def test_field_level_confidence_and_review(client: AsyncClient, db_session: AsyncSession):
    """
    Phase 3: Per-field confidence check.
    If any field is < 0.75, it triggers needs_review and is listed in low_confidence_refs.
    """
    user_res = await client.post("/api/v1/users", json={"device_id": "test-device-phase3-2"})
    user_id = user_res.json()["id"]
    headers = {"X-Device-Id": "test-device-phase3-2", "X-User-Id": user_id}

    payload = {
        "items": [
            {
                "lender": "Unknown Lender",
                "emi": 1500.0,
                "due_date": "2026-10-20",
                "message_type": "emi_reminder",
                "loan_identifier": None,
                "confidence": {
                    "lender": 0.50,  # Below 0.75!
                    "emi": 0.95,
                    "due_date": 0.90,
                    "overall": 0.50
                },
                "local_message_ref": "low-conf-uuid-1"
            }
        ]
    }

    res = await client.post("/api/v1/loans/structured-ingest", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "low-conf-uuid-1" in data["low_confidence_refs"]


@pytest.mark.asyncio
async def test_opt_in_fallback_parse_requires_consent(client: AsyncClient, db_session: AsyncSession):
    """
    Phase 3: Opt-in raw text fallback parsing requires explicit user consent
    and assigns retention_expires_at.
    """
    user_res = await client.post("/api/v1/users", json={"device_id": "test-device-phase3-3"})
    user_id = user_res.json()["id"]
    headers = {"X-Device-Id": "test-device-phase3-3", "X-User-Id": user_id}

    # 1. Attempt without consent -> 400 Bad Request
    fail_payload = {
        "raw_text": "Your LazyPay EMI of Rs 2500 is due on 25 Oct",
        "sender": "LZPAY",
        "user_consent": False
    }
    fail_res = await client.post("/api/v1/messages/fallback-parse", json=fail_payload, headers=headers)
    assert fail_res.status_code == 400

    # 2. Attempt with consent -> Success
    success_payload = {
        "raw_text": "Your LazyPay EMI of Rs 2500 is due on 25 Oct",
        "sender": "LZPAY",
        "user_consent": True,
        "retention_days": 14
    }
    succ_res = await client.post("/api/v1/messages/fallback-parse", json=success_payload, headers=headers)
    assert succ_res.status_code == 200
    ev = succ_res.json()
    assert ev["lender"] == "LazyPay"
    assert ev["emi_amount"] == 2500.0

    # 3. Check raw_messages has retention_expires_at set
    raw_msgs = (await db_session.execute(select(RawMessage).where(RawMessage.user_id == user_id))).scalars().all()
    assert len(raw_msgs) == 1
    assert raw_msgs[0].opt_in_fallback is True
    assert raw_msgs[0].retention_expires_at is not None


@pytest.mark.asyncio
async def test_loan_timeline_reconstruction(client: AsyncClient, db_session: AsyncSession):
    """
    Phase 3: Loan Timeline Reconstruction.
    Verifies chronological ordering and projected future installment.
    """
    user_res = await client.post("/api/v1/users", json={"device_id": "test-device-phase3-4"})
    user_id = user_res.json()["id"]
    headers = {"X-Device-Id": "test-device-phase3-4", "X-User-Id": user_id}

    # Ingest 2 events for Navi loan
    payload = {
        "items": [
            {
                "lender": "Navi",
                "emi": 4500.0,
                "due_date": "2026-08-10",
                "message_type": "loan_approved",
                "confidence": {"lender": 0.95, "emi": 0.95, "due_date": 0.90, "overall": 0.90}
            },
            {
                "lender": "Navi",
                "emi": 4500.0,
                "due_date": "2026-09-10",
                "message_type": "emi_generated",
                "confidence": {"lender": 0.95, "emi": 0.95, "due_date": 0.90, "overall": 0.90}
            }
        ]
    }
    await client.post("/api/v1/loans/structured-ingest", json=payload, headers=headers)

    loans = (await client.get("/api/v1/loans", headers=headers)).json()
    loan_id = loans[0]["id"]

    # Fetch timeline
    timeline_res = await client.get(f"/api/v1/loans/{loan_id}/timeline", headers=headers)
    assert timeline_res.status_code == 200
    tl = timeline_res.json()
    assert tl["loan_id"] == loan_id
    assert len(tl["timeline"]) >= 3  # 2 historical + 1 projected
    
    # Last node should be projected
    last_node = tl["timeline"][-1]
    assert last_node["is_projected"] is True
    assert "projected" in last_node["node_type"].lower()
    assert last_node["amount"] == 4500.0


@pytest.mark.asyncio
async def test_explainable_risk_warnings(client: AsyncClient, db_session: AsyncSession):
    """
    Phase 3: Explainable Warnings.
    Verifies plain-language bullets and deterministic templated summaries.
    """
    user_res = await client.post("/api/v1/users", json={"device_id": "test-device-phase3-5"})
    user_id = user_res.json()["id"]
    headers = {"X-Device-Id": "test-device-phase3-5", "X-User-Id": user_id}

    # Set income
    await client.post(
        f"/api/v1/users/{user_id}/income-profile",
        json={"monthly_income": 50000.0, "salary_date": 1, "safe_emi_ratio": 0.40},
        headers=headers
    )

    # Ingest EMI = 25000 (50% ratio -> over limit)
    payload = {
        "items": [
            {
                "lender": "Slice",
                "emi": 25000.0,
                "due_date": "2026-10-05",
                "confidence": {"lender": 0.95, "emi": 0.95, "due_date": 0.90, "overall": 0.90}
            }
        ]
    }
    await client.post("/api/v1/loans/structured-ingest", json=payload, headers=headers)

    # Explain current risk
    explain_res = await client.get("/api/v1/risk/explain/current", headers=headers)
    assert explain_res.status_code == 200
    exp = explain_res.json()
    assert exp["risk_status"] == "over_limit"
    assert exp["repayment_ratio_pct"] == 50.0
    assert len(exp["bullets"]) >= 4
    assert "exceed your configured safe threshold" in exp["plain_language_summary"]


@pytest.mark.asyncio
async def test_privacy_purge_and_delete_all(client: AsyncClient, db_session: AsyncSession):
    """
    Phase 3 Privacy Center:
    Purge raw messages and cascading delete of all user data.
    """
    user_res = await client.post("/api/v1/users", json={"device_id": "test-device-phase3-6"})
    user_id = user_res.json()["id"]
    headers = {"X-Device-Id": "test-device-phase3-6", "X-User-Id": user_id}

    # Ingest a fallback message (creates raw message)
    await client.post(
        "/api/v1/messages/fallback-parse",
        json={"raw_text": "Your CASHe EMI Rs 1200 due tomorrow", "sender": "CASHE", "user_consent": True},
        headers=headers
    )

    # 1. Purge raw messages
    purge_res = await client.post("/api/v1/privacy/purge-raw-messages", headers=headers)
    assert purge_res.status_code == 200
    assert purge_res.json()["purged_count"] >= 1

    # Check raw_messages empty
    raw_msgs = (await db_session.execute(select(RawMessage).where(RawMessage.user_id == user_id))).scalars().all()
    assert len(raw_msgs) == 0

    # 2. Export structured data before deletion
    export_res = await client.get("/api/v1/privacy/export", headers=headers)
    assert export_res.status_code == 200
    export_data = export_res.json()
    assert export_data["user_id"] == user_id
    assert len(export_data["loans"]) >= 1

    # 3. Cascading delete-all
    del_res = await client.post("/api/v1/privacy/delete-all", headers=headers)
    assert del_res.status_code == 200

    # Verify loans wiped
    loans = (await db_session.execute(select(Loan).where(Loan.user_id == user_id))).scalars().all()
    assert len(loans) == 0

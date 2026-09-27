import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_full_api_lifecycle(client: AsyncClient):
    # 1. Create User
    user_res = await client.post("/users", json={"device_id": "test-device-999"})
    assert user_res.status_code == 201
    user_data = user_res.json()
    user_id = user_data["id"]
    headers = {"X-User-Id": user_id}

    # 2. Save Income Profile
    inc_payload = {
        "monthly_income": 45000.0,
        "salary_date": 1,
        "fixed_expenses": 18000.0,
        "safe_emi_ratio": 0.40,
        "emergency_buffer": 10000.0,
        "calculation_method": "gross"
    }
    inc_res = await client.post(f"/users/{user_id}/income-profile", json=inc_payload)
    assert inc_res.status_code == 200
    assert inc_res.json()["max_safe_emi"] == 18000.0

    # 3. Ingest SMS Messages
    messages = [
        {"source": "sms", "sender": "VM-LAZYPAY", "raw_text": "LazyPay bill of ₹2,499 due on 23 Sep 2026"},
        {"source": "sms", "sender": "BZ-KRDTBI", "raw_text": "₹3,200 repayment due for your KreditBee loan on 25 Sep 2026"},
        {"source": "sms", "sender": "NAVIFN", "raw_text": "Navi EMI of ₹1,850 due on 28 Sep 2026"}
    ]
    ingest_res = await client.post("/messages/ingest", json={"messages": messages}, headers=headers)
    assert ingest_res.status_code == 200
    ingest_data = ingest_res.json()
    assert ingest_data["processed_count"] == 3

    # 4. List Loans
    loans_res = await client.get("/loans", headers=headers)
    assert loans_res.status_code == 200
    loans = loans_res.json()
    assert len(loans) == 3

    # 5. Dashboard Summary
    dash_res = await client.get("/dashboard/summary", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["monthly_income"] == 45000.0
    assert dash_data["total_emi"] == 7549.0  # 2499 + 3200 + 1850
    assert dash_data["risk_status"] == "safe"

    # 6. Calendar Upcoming
    cal_res = await client.get("/calendar/upcoming", headers=headers)
    assert cal_res.status_code == 200
    cal_data = cal_res.json()
    assert len(cal_data["upcoming_repayments"]) == 3

    # 7. Manual Loan Edit
    loan_to_edit = loans[0]
    patch_res = await client.patch(
        f"/loans/{loan_to_edit['id']}",
        json={"emi_amount": 2600.0, "lender": "LazyPay Card"},
        headers=headers
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["emi_amount"] == 2600.0

    # 8. Mark Not a Loan
    loan_to_dismiss = loans[1]
    dismiss_res = await client.post(f"/loans/{loan_to_dismiss['id']}/mark-not-loan", headers=headers)
    assert dismiss_res.status_code == 200

    # Verify loan excluded from active list
    loans_after_dismiss = (await client.get("/loans", headers=headers)).json()
    assert len(loans_after_dismiss) == 2

    # 9. Merge Loans
    merge_res = await client.post(
        f"/loans/{loans_after_dismiss[0]['id']}/merge",
        json={"merge_with_loan_id": loans_after_dismiss[1]['id']},
        headers=headers
    )
    assert merge_res.status_code == 200
    loans_after_merge = (await client.get("/loans", headers=headers)).json()
    assert len(loans_after_merge) == 1

    # 10. Phase 2: Unified Calendar API
    unified_cal_res = await client.get("/calendar/unified?month=9&year=2026", headers=headers)
    assert unified_cal_res.status_code == 200
    unified_data = unified_cal_res.json()
    assert "days" in unified_data
    assert "this_month_total" in unified_data

    # 11. Phase 2: Repayment Ratio API
    ratio_res = await client.get("/risk/ratio", headers=headers)
    assert ratio_res.status_code == 200
    ratio_data = ratio_res.json()
    assert "ratio_pct" in ratio_data
    assert "safe_limit_pct" in ratio_data
    assert "trend_direction" in ratio_data

    # 12. Phase 2: Loan Simulation API ("What-if" calculator)
    sim_res = await client.post(
        "/simulate/new-loan",
        json={
            "loan_amount": 20000.0,
            "new_emi": 3500.0,
            "duration_months": 6,
            "preferred_due_day": 15
        },
        headers=headers
    )
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["new_emi"] == 3500.0
    assert "ratio_before" in sim_data
    assert "ratio_after" in sim_data
    assert "calendar_impact" in sim_data

    # 13. Phase 2: Payment Pressure Windows API
    pressure_res = await client.get("/risk/pressure-windows", headers=headers)
    assert pressure_res.status_code == 200
    pressure_data = pressure_res.json()
    assert "active_windows" in pressure_data

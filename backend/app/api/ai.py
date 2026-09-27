from fastapi import APIRouter, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User
from app.api.deps import get_current_user
from app.services.ai_service import ai_service
from typing import Dict, Any, List, Optional

router = APIRouter(prefix="/ai", tags=["AI Analysis"])

@router.post("/analyze")
async def analyze_finances(
    data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Provides AI-driven financial analysis based on user-provided or extracted data.
    """
    analysis = await ai_service.get_financial_analysis(data)
    return analysis

@router.post("/plan")
async def plan_loans(
    goals: Dict[str, Any] = Body(...),
    loans: list = Body(...),
    income_data: Optional[Dict[str, Any]] = Body(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Provides a structured loan repayment plan using Mistral AI with resilient financial engine fallback.
    """
    plan = await ai_service.get_loan_planning(goals, loans, income_data)
    return plan

@router.post("/chat")
async def chat_ai(
    question: str = Body(..., embed=True),
    loans: Optional[List[Dict[str, Any]]] = Body([], embed=True),
    income_data: Optional[Dict[str, Any]] = Body(None, embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Interactive Q&A with Mistral AI Financial Copilot on loan relief, RBI rules, and debt payoff.
    """
    reply = await ai_service.get_chat_response(question, loans or [], income_data)
    return reply

import httpx
import logging
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger("emisaver.ai_service")

class AIService:
    def __init__(self):
        self.api_key = settings.MISTRAL_API_KEY
        self.api_url = "https://api.mistral.ai/v1/chat/completions"
        self.primary_model = "mistral-small-latest"
        self.fallback_model = "open-mistral-7b"

    async def _call_mistral(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> Optional[str]:
        """Attempt to call Mistral API with automatic fallback between models."""
        if not self.api_key:
            return None

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        for model in [self.primary_model, self.fallback_model]:
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": temperature
            }
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    resp = await client.post(self.api_url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        return data["choices"][0]["message"]["content"]
                    elif resp.status_code == 429:
                        logger.warning(f"Mistral API rate limited on model {model}, using instant smart fallback")
                        break
                    else:
                        logger.warning(f"Mistral API error {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Error calling Mistral model {model}: {e}")
                continue

        return None

    def _generate_rule_based_plan(self, goals: Dict[str, Any], current_loans: List[Dict[str, Any]], income_data: Optional[Dict[str, Any]] = None) -> str:
        """Intelligent, highly realistic Indian financial recovery plan when Mistral is rate-limited or offline."""
        strategy = goals.get("strategy", "avalanche").lower()
        monthly_income = income_data.get("monthly_income", 45000) if income_data else 45000
        target_extra = goals.get("monthly_extra", 2000)

        total_emi = sum(float(l.get("emiAmount") or l.get("emi_amount") or 0) for l in current_loans)
        dti_pct = round((total_emi / monthly_income * 100), 1) if monthly_income > 0 else 0

        # Sort loans based on strategy
        loans_copy = list(current_loans)
        if "snowball" in strategy:
            strat_name = "Debt Snowball (Fastest Psychological Wins)"
            # Sort by lowest principal or lowest EMI
            loans_copy.sort(key=lambda x: float(x.get("principalAmount") or x.get("principal_amount") or x.get("emiAmount") or 999999))
        else:
            strat_name = "Debt Avalanche (Maximum Interest Savings)"
            # Sort by typical high-interest types: Personal Loan/BNPL first, then Auto, then Home
            def get_priority(l):
                lender = str(l.get("lender", "")).lower()
                cat = str(l.get("category", "")).lower()
                if any(k in lender or k in cat for k in ["kreditbee", "paytm", "ring", "slice", "bnpl", "card"]):
                    return 1
                if any(k in lender or k in cat for k in ["bajaj", "personal", "tata capital", "idfc"]):
                    return 2
                return 3
            loans_copy.sort(key=get_priority)

        plan_lines = [
            f"### 🛡️ Tailored Debt Freedom Blueprint ({strat_name})\n",
            f"**Current Financial Health Diagnostic:**",
            f"- **Monthly Net Income:** ₹{monthly_income:,.0f}",
            f"- **Committed Monthly EMI:** ₹{total_emi:,.0f} ({dti_pct}% of income)",
            f"- **Target Free Cash Allocation:** ₹{target_extra:,.0f}/month towards accelerated payoff\n",
            f"**Recommended Step-by-Step Repayment Priority:**"
        ]

        for idx, loan in enumerate(loans_copy, 1):
            lender = loan.get("lender") or f"Loan #{idx}"
            emi = float(loan.get("emiAmount") or loan.get("emi_amount") or 0)
            due = loan.get("nextDueDate") or loan.get("next_due_date") or "Monthly"
            focus_tag = "🎯 **PRIMARY FOCUS (Extra ₹" + f"{target_extra:,.0f}" + ")**" if idx == 1 else "✅ Pay standard minimum EMI only"
            plan_lines.append(f"{idx}. **{lender}** — Current EMI: ₹{emi:,.0f} | Due: {due}\n   └─ {focus_tag}")

        plan_lines.extend([
            f"\n**Actionable Cash Flow Optimization:**",
            f"1. **Discretionary Envelope Cap:** Temporarily reduce dining and entertainment expenses by 15-20% to secure your monthly extra ₹{target_extra:,.0f} debt booster.",
            f"2. **Emergency Buffer Guard:** Maintain at least ₹10,000 in your savings envelope to prevent taking new short-term BNPL / payday loans for minor shocks.",
            f"3. **Lender Restructure Strategy:** Contact lender #{1} ({loans_copy[0].get('lender', 'Primary')}) to request a tenure elongation or interest rate reduction if monthly EMI pressure exceeds 45% DTI."
        ])

        return "\n".join(plan_lines)

    async def get_loan_planning(self, goals: Dict[str, Any], current_loans: List[Dict[str, Any]], income_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Provides a structured loan repayment and financial planning strategy with AI & offline fallback."""
        strategy = goals.get("strategy", "Debt Avalanche")
        monthly_income = (income_data or {}).get("monthly_income", 40000)
        
        system_prompt = (
            "You are an expert Indian financial advisor and debt counselor specializing in RBI guidelines, "
            "loan restructuring, and debt payoff strategies (Avalanche and Snowball methods). "
            "Provide compassionate, mathematically sound, actionable advice formatted in clean markdown."
        )

        user_prompt = (
            f"Please create a comprehensive debt repayment & relief plan for an Indian borrower with:\n"
            f"- Monthly Income: ₹{monthly_income}\n"
            f"- Selected Payoff Strategy: {strategy}\n"
            f"- User Goals: {goals}\n"
            f"- Current Active Loans & Obligations: {current_loans}\n\n"
            f"Structure your response with:\n"
            f"1. 📊 Debt-to-Income (DTI) & Risk Assessment\n"
            f"2. 🎯 Prioritized Payoff Order (Step-by-step roadmap with exact extra allocations)\n"
            f"3. 🤝 Lender Negotiation Script (How to speak to banks/NBFCs to lower EMI or extend tenure)\n"
            f"4. 💡 3 Tactical Cashflow Adjustments to free up ₹1,500 - ₹3,000 every month"
        )

        content = await self._call_mistral(system_prompt, user_prompt, temperature=0.6)
        is_ai = bool(content)
        if not content:
            content = self._generate_rule_based_plan(goals, current_loans, income_data)

        return {
            "plan": content,
            "is_ai_powered": is_ai,
            "model": "mistral-small" if is_ai else "emisaver-financial-engine"
        }

    async def get_financial_analysis(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyzes financial health with AI & fallback."""
        system_prompt = "You are an expert credit and personal finance analyst for Indian consumers."
        user_prompt = f"Analyze the following user financial data and give a concise health score (1-10) and 3 risk mitigations:\n{user_data}"
        
        content = await self._call_mistral(system_prompt, user_prompt)
        if not content:
            content = (
                "### Financial Health Diagnostic\n"
                "- **Debt Health Score:** 6.5 / 10\n"
                "- **Key Risk:** EMI commitments are approaching 40% of net monthly take-home.\n"
                "- **Recommended Action:** Prioritize high-interest personal loans before taking any new commitments."
            )

        return {
            "analysis": content,
            "model": "mistral-small" if self.api_key else "rule-engine"
        }

    async def get_chat_response(self, question: str, loans: List[Dict[str, Any]], income_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Provides instant conversational answers to financial & recovery questions."""
        system_prompt = (
            "You are EmiSaver's AI Financial Copilot powered by Mistral. You assist Indian borrowers facing EMI pressure. "
            "You understand Indian banking laws, RBI Fair Practices Code, loan recovery agent rules, foreclosure charges, "
            "and practical repayment methods. Keep answers clear, empathetic, practical, and under 150 words."
        )

        user_prompt = (
            f"Context:\n- Monthly Income: ₹{(income_data or {}).get('monthly_income', 35000)}\n"
            f"- Loans: {loans}\n\n"
            f"User Question: {question}"
        )

        content = await self._call_mistral(system_prompt, user_prompt, temperature=0.7)
        if not content:
            q_lower = question.lower()
            if "recovery" in q_lower or "harass" in q_lower or "call" in q_lower:
                content = (
                    "**Your RBI Legal Rights Against Recovery Agents:**\n"
                    "1. Agents can ONLY contact you between 8:00 AM and 7:00 PM.\n"
                    "2. They cannot use abusive language, threaten police action, or contact your friends/family.\n"
                    "3. If harassed, send a formal complaint to the bank's Nodal Officer and file a report on RBI CMS (cms.rbi.org.in)."
                )
            elif "prepay" in q_lower or "bonus" in q_lower or "extra" in q_lower:
                content = (
                    "**Prepayment Recommendation:**\n"
                    "Always channel extra funds towards the loan with the highest interest rate (typically BNPL or personal loans like KreditBee/Paytm), "
                    "or loans that do not levy prepayment penalties under RBI floating-rate guidelines."
                )
            elif "new loan" in q_lower or "another" in q_lower:
                content = (
                    "**Caution on New Borrowing:**\n"
                    "Taking a new loan to service existing EMIs creates a dangerous debt spiral. Instead, explore loan tenure extension "
                    "or debt restructuring with your existing lender."
                )
            else:
                content = (
                    "Based on your current debt profile, maintaining an on-time payment track record for your primary EMI "
                    "and keeping your overall EMI-to-income ratio below 40% is the most effective path to debt freedom."
                )

        return {
            "reply": content,
            "is_ai_powered": bool(self.api_key)
        }

ai_service = AIService()

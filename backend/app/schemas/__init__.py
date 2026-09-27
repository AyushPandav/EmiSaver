from typing import List, Optional, Any, Dict
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict


# --- USER SCHEMAS ---
class UserCreate(BaseModel):
    device_id: str = Field(..., description="Unique client device identifier")


class UserResponse(BaseModel):
    id: str
    device_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- INCOME PROFILE SCHEMAS ---
class IncomeProfileCreate(BaseModel):
    monthly_income: float = Field(..., gt=0, description="Monthly take-home income in INR")
    salary_date: Optional[int] = Field(None, ge=1, le=31, description="Day of month salary arrives")
    fixed_expenses: float = Field(0.0, ge=0, description="Total fixed monthly expenses")
    safe_emi_ratio: float = Field(0.40, ge=0.05, le=1.0, description="Safe EMI limit ratio (e.g. 0.40 = 40%)")
    emergency_buffer: float = Field(0.0, ge=0, description="Optional emergency buffer in INR")
    calculation_method: Optional[str] = Field("gross", description="'gross' = Income * Ratio, 'net' = (Income - Expenses) * Ratio")


class IncomeProfileResponse(BaseModel):
    id: str
    user_id: str
    monthly_income: float
    salary_date: Optional[int] = None
    fixed_expenses: float
    safe_emi_ratio: float
    emergency_buffer: float
    max_safe_emi: float
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- MESSAGE INGESTION SCHEMAS ---
class RawMessageItem(BaseModel):
    source: str = Field("sms", description="'sms' or 'notification'")
    sender: Optional[str] = None
    raw_text: str = Field(..., description="Cleaned/pre-filtered message content")
    received_at: Optional[datetime] = None


class MessageIngestRequest(BaseModel):
    messages: List[RawMessageItem] = Field(..., min_length=1)


class ParsedEventResponse(BaseModel):
    id: str
    lender: Optional[str]
    loan_identifier: Optional[str]
    loan_amount: Optional[float]
    emi_amount: Optional[float]
    due_date: Optional[date]
    repayment_frequency: str
    message_type: Optional[str]
    language_detected: Optional[str]
    confidence: Optional[float]
    needs_review: bool
    matched_loan_id: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class IngestResponse(BaseModel):
    total_received: int
    processed_count: int
    new_events: List[ParsedEventResponse]
    loans_updated: int
    message: str


# --- LOAN SCHEMAS ---
class EmiScheduleItem(BaseModel):
    id: str
    due_date: date
    amount: float
    paid: bool

    model_config = ConfigDict(from_attributes=True)


class LoanResponse(BaseModel):
    id: str
    user_id: str
    lender: str
    loan_identifier: Optional[str] = None
    principal_amount: Optional[float] = None
    emi_amount: float
    repayment_frequency: str
    status: str
    source_confidence: Optional[float] = None
    manually_verified: bool
    next_due_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoanDetailResponse(LoanResponse):
    schedules: List[EmiScheduleItem] = []
    events_count: int = 0


class LoanUpdate(BaseModel):
    lender: Optional[str] = None
    loan_identifier: Optional[str] = None
    emi_amount: Optional[float] = None
    principal_amount: Optional[float] = None
    next_due_date: Optional[date] = None
    repayment_frequency: Optional[str] = None
    status: Optional[str] = None


class LoanMergeRequest(BaseModel):
    merge_with_loan_id: str = Field(..., description="ID of the loan to merge into this one")


# --- DASHBOARD & CALENDAR SCHEMAS ---
class DashboardSummary(BaseModel):
    monthly_income: float
    total_emi: float
    emi_to_income_pct: float
    safe_emi_ratio_pct: float
    max_safe_emi: float
    active_loans_count: int
    risk_status: str  # 'safe', 'caution', 'over_limit'
    currency: str = "₹"
    risk_message: str


class CalendarEntry(BaseModel):
    id: str
    loan_id: str
    lender: str
    due_date: date
    amount: float
    paid: bool
    loan_identifier: Optional[str] = None


class CalendarResponse(BaseModel):
    upcoming_repayments: List[CalendarEntry]
    total_upcoming_amount: float


# --- PHASE 2 SCHEMAS ---

# 1. Unified Calendar Schemas
class DayEmiItem(BaseModel):
    loan_id: str
    lender: str
    loan_identifier: Optional[str] = None
    amount: float
    paid: bool


class UnifiedCalendarDay(BaseModel):
    date: date
    day_of_month: int
    day_of_week: str
    total_amount: float
    items: List[DayEmiItem] = []
    is_past: bool = False


class BusiestWeekInfo(BaseModel):
    start_date: date
    end_date: date
    total_amount: float
    installment_count: int


class UnifiedCalendarResponse(BaseModel):
    month: int
    year: int
    days: List[UnifiedCalendarDay]
    this_month_total: float
    next_month_total: float
    busiest_week: Optional[BusiestWeekInfo] = None


# 2. Repayment-to-Income Ratio Schemas
class RepaymentRatioResponse(BaseModel):
    monthly_income: float
    total_monthly_emi: float
    ratio_pct: float
    safe_limit_pct: float
    status: str  # 'within_limit' or 'above_limit'
    is_above_limit: bool
    trend_delta_pct: float  # difference compared to previous month / snapshot
    trend_direction: str  # 'up', 'down', 'flat'
    message: str
    normalization_notes: Optional[List[str]] = None


# 3. Loan Simulation Schemas
class LoanSimulationRequest(BaseModel):
    loan_amount: Optional[float] = Field(None, gt=0, description="Principal amount of loan")
    new_emi: float = Field(..., gt=0, description="Expected monthly or installment EMI")
    duration_months: int = Field(..., gt=0, le=120, description="Loan duration in months")
    preferred_due_day: Optional[int] = Field(None, ge=1, le=31, description="Day of month for EMI due date")


class SimulationCalendarImpact(BaseModel):
    simulated_due_day: int
    dates_added: List[date]
    lands_in_concentration_window: bool
    creates_new_pressure_window: bool
    impact_summary: str


class LoanSimulationResponse(BaseModel):
    current_emi: float
    new_emi: float
    combined_emi: float
    monthly_income: float
    ratio_before: float
    ratio_after: float
    delta_pp: float  # percentage point delta
    additional_monthly_commitment: float
    is_above_safe_limit: bool
    safe_limit_pct: float
    calendar_impact: SimulationCalendarImpact


# 4. Payment Pressure Score & Window Schemas
class PressureWindowResponse(BaseModel):
    id: str
    window_start: date
    window_end: date
    total_due: float
    pressure_score: float
    severity: str  # 'info', 'caution', 'high'
    contributing_factors: Dict[str, Any]
    computed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PressureWindowListResponse(BaseModel):
    active_windows: List[PressureWindowResponse]
    highest_severity: Optional[str] = None
    total_high_pressure_windows: int


# ==========================================
# Phase 3 Schemas: On-Device & Privacy-First
# ==========================================

class FieldConfidence(BaseModel):
    lender: float = Field(..., ge=0.0, le=1.0)
    emi: float = Field(..., ge=0.0, le=1.0)
    due_date: float = Field(..., ge=0.0, le=1.0)
    overall: float = Field(..., ge=0.0, le=1.0)


class StructuredIngestItem(BaseModel):
    lender: Optional[str] = None
    emi: Optional[float] = None
    due_date: Optional[date] = None
    message_type: Optional[str] = "emi_reminder"
    loan_identifier: Optional[str] = None
    confidence: FieldConfidence
    local_message_ref: Optional[str] = None


class StructuredIngestRequest(BaseModel):
    items: List[StructuredIngestItem] = Field(..., min_length=1)


class StructuredIngestResponse(BaseModel):
    total_received: int
    processed_count: int
    loans_updated: int
    new_events_count: int
    low_confidence_refs: List[str] = []
    message: str


class FallbackParseRequest(BaseModel):
    source: str = "sms"
    sender: Optional[str] = None
    raw_text: str = Field(..., min_length=1)
    local_message_ref: Optional[str] = None
    user_consent: bool = Field(..., description="Explicit user opt-in confirmation for backend fallback parsing")
    retention_days: int = Field(default=14, ge=1, le=30)


class LoanTimelineNode(BaseModel):
    event_id: Optional[str] = None
    event_date: date
    title: str
    description: str
    node_type: str  # 'loan_approved', 'disbursed', 'emi_generated', 'emi_due', 'payment_confirmed', 'projected'
    amount: Optional[float] = None
    confidence: Optional[float] = None
    is_projected: bool = False


class LoanTimelineResponse(BaseModel):
    loan_id: str
    lender: str
    loan_identifier: Optional[str] = None
    status: str
    total_events: int
    timeline: List[LoanTimelineNode]


class RiskExplanationResponse(BaseModel):
    risk_status: str
    repayment_ratio_pct: float
    monthly_income: float
    total_monthly_emi: float
    bullets: List[str]
    plain_language_summary: str
    evaluated_factors: Dict[str, Any]


class PurgeMessagesResponse(BaseModel):
    purged_count: int
    message: str


class PrivacyExportResponse(BaseModel):
    user_id: str
    exported_at: datetime
    income_profile: Optional[Dict[str, Any]] = None
    loans: List[Dict[str, Any]] = []
    emi_schedules: List[Dict[str, Any]] = []
    loan_events: List[Dict[str, Any]] = []
    pressure_windows: List[Dict[str, Any]] = []



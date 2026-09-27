import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, Numeric, SmallInteger, Text, Date, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    device_id = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    income_profile = relationship("IncomeProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    raw_messages = relationship("RawMessage", back_populates="user", cascade="all, delete-orphan")
    parsed_loan_events = relationship("ParsedLoanEvent", back_populates="user", cascade="all, delete-orphan")
    loans = relationship("Loan", back_populates="user", cascade="all, delete-orphan")
    user_corrections = relationship("UserCorrection", back_populates="user", cascade="all, delete-orphan")
    risk_snapshots = relationship("RiskSnapshot", back_populates="user", cascade="all, delete-orphan")
    pressure_windows = relationship("PressureWindow", back_populates="user", cascade="all, delete-orphan")
    loan_simulations = relationship("LoanSimulation", back_populates="user", cascade="all, delete-orphan")


class IncomeProfile(Base):
    __tablename__ = "income_profile"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    monthly_income = Column(Numeric(12, 2), nullable=False)
    salary_date = Column(SmallInteger, nullable=True)
    fixed_expenses = Column(Numeric(12, 2), default=0)
    safe_emi_ratio = Column(Numeric(4, 2), nullable=False, default=0.40)
    emergency_buffer = Column(Numeric(12, 2), default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="income_profile")


class RawMessage(Base):
    __tablename__ = "raw_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source = Column(String(20), default="sms")  # 'sms' or 'notification'
    sender = Column(String(100), nullable=True)
    raw_text = Column(Text, nullable=False)
    received_at = Column(DateTime, nullable=True)
    processed = Column(Boolean, default=False)
    opt_in_fallback = Column(Boolean, default=True)  # Phase 3: opt-in raw message fallback only
    retention_expires_at = Column(DateTime, nullable=True)  # Phase 3: auto-purge retention timestamp
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="raw_messages")
    parsed_event = relationship("ParsedLoanEvent", back_populates="raw_message", uselist=False, cascade="all, delete-orphan")


class ParsedLoanEvent(Base):
    __tablename__ = "parsed_loan_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    raw_message_id = Column(String(36), ForeignKey("raw_messages.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lender = Column(String(100), nullable=True)
    loan_identifier = Column(String(100), nullable=True)
    loan_amount = Column(Numeric(12, 2), nullable=True)
    emi_amount = Column(Numeric(12, 2), nullable=True)
    due_date = Column(Date, nullable=True)
    repayment_frequency = Column(String(50), default="monthly")
    message_type = Column(String(50), nullable=True)
    language_detected = Column(String(20), nullable=True)
    confidence = Column(Numeric(4, 2), nullable=True)  # Derived overall confidence
    field_confidence = Column(JSON, nullable=True)  # Phase 3: per-field {"lender": 0.88, "emi_amount": 0.97, "due_date": 0.94}
    local_message_ref = Column(String(36), nullable=True)  # Phase 3: on-device correlation reference
    needs_review = Column(Boolean, default=False)
    matched_loan_id = Column(String(36), ForeignKey("loans.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="parsed_loan_events")
    raw_message = relationship("RawMessage", back_populates="parsed_event")
    loan = relationship("Loan", back_populates="events")


class Loan(Base):
    __tablename__ = "loans"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lender = Column(String(100), nullable=False)
    loan_identifier = Column(String(100), nullable=True)
    principal_amount = Column(Numeric(12, 2), nullable=True)
    emi_amount = Column(Numeric(12, 2), nullable=False)
    repayment_frequency = Column(String(50), default="monthly")
    status = Column(String(20), default="active")  # 'active', 'closed', 'disputed'
    source_confidence = Column(Numeric(4, 2), nullable=True)
    manually_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="loans")
    events = relationship("ParsedLoanEvent", back_populates="loan")
    schedule = relationship("EmiSchedule", back_populates="loan", cascade="all, delete-orphan")
    corrections = relationship("UserCorrection", back_populates="loan")


class EmiSchedule(Base):
    __tablename__ = "emi_schedule"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    loan_id = Column(String(36), ForeignKey("loans.id", ondelete="CASCADE"), nullable=False, index=True)
    due_date = Column(Date, nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    paid = Column(Boolean, default=False)
    source_event_id = Column(String(36), ForeignKey("parsed_loan_events.id", ondelete="SET NULL"), nullable=True)

    loan = relationship("Loan", back_populates="schedule")


class UserCorrection(Base):
    __tablename__ = "user_corrections"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    loan_id = Column(String(36), ForeignKey("loans.id", ondelete="SET NULL"), nullable=True)
    correction_type = Column(String(50), nullable=False)  # 'edit', 'merge', 'split', 'mark_not_loan'
    before_value = Column(JSON, nullable=True)
    after_value = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="user_corrections")
    loan = relationship("Loan", back_populates="corrections")


class RiskSnapshot(Base):
    __tablename__ = "risk_snapshots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    total_emi = Column(Numeric(12, 2), nullable=False)
    emi_to_income_pct = Column(Numeric(6, 2), nullable=False)
    risk_status = Column(String(20), nullable=False)  # 'safe', 'caution', 'over_limit'
    computed_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="risk_snapshots")


class PressureWindow(Base):
    __tablename__ = "pressure_windows"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    window_start = Column(Date, nullable=False)
    window_end = Column(Date, nullable=False)
    total_due = Column(Numeric(12, 2), nullable=False)
    pressure_score = Column(Numeric(5, 2), nullable=False)
    severity = Column(String(20), nullable=False)  # 'info', 'caution', 'high'
    contributing_factors = Column(JSON, nullable=False)
    computed_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="pressure_windows")


class LoanSimulation(Base):
    __tablename__ = "loan_simulations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    loan_amount = Column(Numeric(12, 2), nullable=True)
    new_emi = Column(Numeric(12, 2), nullable=False)
    duration_months = Column(SmallInteger, nullable=True)
    ratio_before = Column(Numeric(6, 2), nullable=True)
    ratio_after = Column(Numeric(6, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="loan_simulations")

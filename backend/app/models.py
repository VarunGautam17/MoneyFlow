import uuid
from sqlalchemy import Column, String, Float, DateTime, Enum, ForeignKey, Integer, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .database import Base

class SessionStatus(str, enum.Enum):
    pending = "pending"
    parsing = "parsing"
    processing = "processing"
    ready = "ready"
    failed = "failed"

class TransactionType(str, enum.Enum):
    credit = "credit"
    debit = "debit"

class UploadSession(Base):
    __tablename__ = "upload_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    file_type = Column(String)
    bank_hint = Column(String, nullable=True)
    status = Column(Enum(SessionStatus), default=SessionStatus.pending)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)

    transactions = relationship("Transaction", back_populates="session", cascade="all, delete-orphan")
    analysis_results = relationship("AnalysisResult", back_populates="session", cascade="all, delete-orphan")
    recurring_groups = relationship("RecurringGroup", back_populates="session", cascade="all, delete-orphan")

class RecurringGroup(Base):
    __tablename__ = "recurring_groups"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("upload_sessions.id"))
    name = Column(String, nullable=False)
    typical_amount = Column(Float, nullable=False)
    frequency = Column(String, nullable=False, default="monthly")
    confidence = Column(Float, nullable=False)
    category = Column(String, nullable=False)

    session = relationship("UploadSession", back_populates="recurring_groups")
    transactions = relationship("Transaction", back_populates="recurring_group")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("upload_sessions.id"))
    date = Column(String, nullable=False) # ISO format date YYYY-MM-DD
    description_raw = Column(String, nullable=False)
    description_clean = Column(String, nullable=True)
    amount = Column(Float, nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    balance = Column(Float, nullable=True)
    category = Column(String, nullable=True)
    category_confidence = Column(Float, nullable=True)
    is_recurring = Column(Boolean, default=False)
    recurring_group_id = Column(String, ForeignKey("recurring_groups.id"), nullable=True)
    metadata_json = Column(JSON, nullable=True)

    session = relationship("UploadSession", back_populates="transactions")
    recurring_group = relationship("RecurringGroup", back_populates="transactions")

class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("upload_sessions.id"))
    metrics = Column(JSON) # income, spend, savings, etc.
    top_categories = Column(JSON)
    biggest_transactions = Column(JSON)
    insights = Column(JSON)
    generated_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("UploadSession", back_populates="analysis_results")

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from .models import SessionStatus, TransactionType

class TransactionBase(BaseModel):
    date: str
    description_raw: str
    description_clean: Optional[str] = None
    amount: float
    type: TransactionType
    balance: Optional[float] = None
    category: Optional[str] = None
    category_confidence: Optional[float] = None
    is_recurring: bool = False
    recurring_group_id: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None

class Transaction(TransactionBase):
    id: str
    session_id: str

    class Config:
        from_attributes = True

class RecurringGroupBase(BaseModel):
    name: str
    typical_amount: float
    frequency: str = "monthly"
    confidence: float
    category: str

class RecurringGroup(RecurringGroupBase):
    id: str
    session_id: str
    transactions: List[Transaction] = []

    class Config:
        from_attributes = True

class UploadSessionBase(BaseModel):
    filename: str
    file_type: Optional[str] = None
    bank_hint: Optional[str] = None

class UploadSession(UploadSessionBase):
    id: str
    status: SessionStatus
    uploaded_at: datetime
    expires_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

class AnalysisResultBase(BaseModel):
    metrics: Dict[str, Any]
    top_categories: List[Dict[str, Any]]
    biggest_transactions: List[Dict[str, Any]]
    insights: List[str]

class AnalysisResult(AnalysisResultBase):
    id: str
    session_id: str
    generated_at: datetime

    class Config:
        from_attributes = True

class TransactionUpdate(BaseModel):
    category: str

class ColumnMapping(BaseModel):
    date: Optional[str] = None
    description: Optional[str] = None
    debit: Optional[str] = None
    credit: Optional[str] = None
    amount: Optional[str] = None
    balance: Optional[str] = None

class CsvPreview(BaseModel):
    columns: List[str]
    sample_rows: List[Dict[str, Any]]
    suggested_mapping: ColumnMapping
    header_row: int
    confidence_score: float
    auto_process: bool

class BankPreset(BaseModel):
    name: str
    code: str
    column_mapping: ColumnMapping
    date_format: Optional[str] = None


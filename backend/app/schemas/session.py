from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field


class SessionResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    bank_hint: Optional[str] = None
    status: str
    uploaded_at: datetime
    expires_at: datetime | None
    row_count: int
    error_message: str | None
    parse_warnings: list[str] = Field(default_factory=list)


class UploadResponse(BaseModel):
    session_id: str
    status: str
    message: str = "Processing complete"


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

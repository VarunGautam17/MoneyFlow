import json
import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import UploadSession
from app.models.enums import SessionStatus
from app.schemas.session import SessionResponse, UploadResponse, ColumnMapping, CsvPreview, BankPreset
from app.services.pipeline import delete_upload_temp, run_pipeline, save_upload_temp

router = APIRouter(tags=["upload"])

ALLOWED_EXTENSIONS = {".csv", ".xlsx"}


@router.post("/upload", response_model=UploadResponse)
async def upload_statement(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> UploadResponse:
    settings = get_settings()
    filename = file.filename or "statement.csv"
    ext = Path(filename).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. Upload HDFC/ICICI CSV, a generic CSV, or Excel (.xlsx). "
                "See docs/sample-statement-template.csv for the expected format."
            ),
        )

    content = await file.read()
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_size_mb} MB limit")

    session = UploadSession(
        filename=filename,
        file_type=ext.lstrip("."),
        status=SessionStatus.PENDING.value,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    temp_path: str | None = None
    try:
        temp_path = save_upload_temp(content, filename)
        run_pipeline(db, session, content, filename)
    finally:
        if temp_path:
            delete_upload_temp(temp_path)

    db.refresh(session)
    if session.status == SessionStatus.FAILED.value:
        raise HTTPException(status_code=422, detail=session.error_message or "Failed to process statement")

    return UploadResponse(session_id=session.id, status=session.status)


@router.post("/upload/preview", response_model=CsvPreview)
async def preview_csv_file(file: UploadFile = File(...)):
    """Preview CSV file and suggest column mapping."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
    content = await file.read()
    
    try:
        from app.parsers.csv_parser import preview_csv
        preview_data = preview_csv(content)
        return CsvPreview(**preview_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to preview CSV: {str(e)}")


@router.get("/upload/bank-presets", response_model=list[BankPreset])
async def get_bank_presets():
    """Get all available bank presets."""
    from app.parsers.bank_presets import get_all_bank_presets
    return get_all_bank_presets()


@router.post("/upload/upload-with-mapping", response_model=UploadResponse)
async def upload_statement_with_mapping(
    file: UploadFile = File(...),
    column_mapping: str = Form(None),
    header_row: int = Form(0),
    bank_code: str = Form(None),
    db: Session = Depends(get_db)
) -> UploadResponse:
    """Upload CSV statement with explicit column mapping."""
    settings = get_settings()
    filename = file.filename or "statement.csv"
    ext = Path(filename).suffix.lower()
    
    if ext != '.csv':
        raise HTTPException(status_code=400, detail="Only CSV files are supported for custom mapping")
        
    content = await file.read()
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_size_mb} MB limit")
        
    mapping_obj = None
    if column_mapping:
        try:
            mapping_dict = json.loads(column_mapping)
            mapping_obj = ColumnMapping(**mapping_dict)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid column_mapping format")
            
    if bank_code and not mapping_obj:
        from app.parsers.bank_presets import get_bank_preset
        preset = get_bank_preset(bank_code)
        if preset:
            mapping_obj = preset.column_mapping
            
    session = UploadSession(
        filename=filename,
        file_type="csv",
        bank_hint=bank_code,
        status=SessionStatus.PENDING.value,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    temp_path = None
    try:
        temp_path = save_upload_temp(content, filename)
        run_pipeline(db, session, content, filename, column_mapping=mapping_obj, header_row=header_row)
    finally:
        if temp_path:
            delete_upload_temp(temp_path)
            
    db.refresh(session)
    if session.status == SessionStatus.FAILED.value:
        raise HTTPException(status_code=422, detail=session.error_message or "Failed to process statement")
        
    return UploadResponse(session_id=session.id, status=session.status)

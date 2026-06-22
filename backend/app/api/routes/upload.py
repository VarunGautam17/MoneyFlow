from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from ...database import get_db
from ... import models, schemas
from ...parsers.csv_parser import parse_generic_csv, parse_csv_with_mapping, preview_csv
from ...parsers.bank_presets import get_all_bank_presets, get_bank_preset
from ...pipeline.cleaner import process_cleaning
from ...pipeline.categorizer import process_categorization
from ...pipeline.metrics import calculate_metrics
from ...pipeline.recurring import detect_recurring_groups
from ...config import settings

router = APIRouter()

def process_upload_task(session_id: str, file_content: bytes, filename: str, db: Session, column_mapping: schemas.ColumnMapping = None, header_row: int = 0):
    session = db.query(models.UploadSession).filter(models.UploadSession.id == session_id).first()
    if not session:
        return
        
    try:
        session.status = models.SessionStatus.parsing
        db.commit()
        
        # Parse
        if column_mapping:
            raw_txns = parse_csv_with_mapping(file_content, column_mapping, header_row)
        else:
            raw_txns = parse_generic_csv(file_content)
        
        session.status = models.SessionStatus.processing
        db.commit()
        
        # Clean
        cleaned_txns = process_cleaning(raw_txns)
        
        # Categorize
        categorized_txns = process_categorization(cleaned_txns)
        
        # Detect recurring payments
        recurring_groups = detect_recurring_groups(categorized_txns)
        
        # Calculate metrics
        metrics_data = calculate_metrics(categorized_txns, recurring_groups)
        
        # Save recurring groups to DB
        db_groups = []
        for group in recurring_groups:
            db_group = models.RecurringGroup(
                id=group["id"],
                session_id=session.id,
                name=group["name"],
                typical_amount=group["typical_amount"],
                frequency=group["frequency"],
                confidence=group["confidence"],
                category=group["category"]
            )
            db_groups.append(db_group)
        db.add_all(db_groups)
        
        # Save transactions to DB
        db_txns = []
        for txn in categorized_txns:
            db_txn = models.Transaction(
                session_id=session.id,
                date=txn.date,
                description_raw=txn.description_raw,
                description_clean=txn.description_clean,
                amount=txn.amount,
                type=txn.type,
                balance=txn.balance,
                category=txn.category,
                category_confidence=txn.category_confidence,
                is_recurring=txn.is_recurring,
                recurring_group_id=txn.recurring_group_id,
                metadata_json=txn.metadata_json
            )
            db_txns.append(db_txn)
            
        db.add_all(db_txns)
        
        # Save metrics
        analysis_result = models.AnalysisResult(
            session_id=session.id,
            metrics=metrics_data["metrics"],
            top_categories=metrics_data["top_categories"],
            biggest_transactions=metrics_data["biggest_transactions"],
            insights=metrics_data["insights"]
        )
        db.add(analysis_result)
        
        session.status = models.SessionStatus.ready
        db.commit()
        
    except Exception as e:
        session.status = models.SessionStatus.failed
        session.error_message = str(e)
        db.commit()


@router.post("/upload", response_model=schemas.UploadSession)
async def upload_statement(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported for now")
        
    content = await file.read()
    
    # Enforce size limit
    max_size_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds the limit of {settings.MAX_UPLOAD_SIZE_MB}MB"
        )
        
    from datetime import datetime, timedelta
    
    # Clean up expired sessions
    try:
        expired = db.query(models.UploadSession).filter(models.UploadSession.expires_at < datetime.utcnow()).all()
        for exp in expired:
            db.delete(exp)
        db.commit()
    except Exception:
        db.rollback()
        
    session = models.UploadSession(
        filename=file.filename,
        file_type="csv",
        expires_at=datetime.utcnow() + timedelta(hours=settings.SESSION_TTL_HOURS)
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # Process synchronously for prototype
    process_upload_task(session.id, content, file.filename, db)
    
    db.refresh(session)
    return session


@router.post("/upload/preview", response_model=schemas.CsvPreview)
async def preview_csv_file(file: UploadFile = File(...)):
    """Preview CSV file and suggest column mapping."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
    content = await file.read()
    
    try:
        preview_data = preview_csv(content)
        return schemas.CsvPreview(**preview_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to preview CSV: {str(e)}")


@router.get("/upload/bank-presets", response_model=List[schemas.BankPreset])
async def get_bank_presets():
    """Get all available bank presets."""
    return get_all_bank_presets()


@router.post("/upload/upload-with-mapping", response_model=schemas.UploadSession)
async def upload_statement_with_mapping(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    column_mapping: schemas.ColumnMapping = None,
    header_row: int = 0,
    bank_code: str = None,
    db: Session = Depends(get_db)
):
    """Upload CSV statement with explicit column mapping."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported for now")
        
    content = await file.read()
    
    # Enforce size limit
    max_size_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds the limit of {settings.MAX_UPLOAD_SIZE_MB}MB"
        )
    
    # Use bank preset if provided
    if bank_code:
        preset = get_bank_preset(bank_code)
        if preset:
            column_mapping = preset.column_mapping
    
    from datetime import datetime, timedelta
    
    # Clean up expired sessions
    try:
        expired = db.query(models.UploadSession).filter(models.UploadSession.expires_at < datetime.utcnow()).all()
        for exp in expired:
            db.delete(exp)
        db.commit()
    except Exception:
        db.rollback()
        
    session = models.UploadSession(
        filename=file.filename,
        file_type="csv",
        bank_hint=bank_code,
        expires_at=datetime.utcnow() + timedelta(hours=settings.SESSION_TTL_HOURS)
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # Process synchronously for prototype
    process_upload_task(session.id, content, file.filename, db, column_mapping, header_row)
    
    db.refresh(session)
    return session

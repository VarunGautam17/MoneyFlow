import pandas as pd
import io
import math
from datetime import datetime
from typing import List, Optional, Dict, Any
from app.parsers.base import RawTransaction
from app.models.enums import TransactionType
from app.schemas.session import ColumnMapping

def find_header_row_index(file_content: bytes) -> int:
    try:
        lines = file_content.decode('utf-8').splitlines()
    except Exception:
        try:
            lines = file_content.decode('latin-1').splitlines()
        except Exception:
            return 0
        
    for i, line in enumerate(lines[:20]):
        cols = [c.lower().strip() for c in line.split(',')]
        has_date = any('date' in c for c in cols)
        has_desc = any('desc' in c or 'narration' in c or 'particular' in c or 'detail' in c or 'info' in c for c in cols)
        if has_date and has_desc:
            return i
    return 0

def parse_generic_csv(file_content: bytes) -> List[TransactionBase]:
    header_idx = find_header_row_index(file_content)
    try:
        df = pd.read_csv(io.BytesIO(file_content), skiprows=header_idx)
    except Exception as e:
        raise ValueError(f"Failed to read CSV: {str(e)}")
    
    # Make columns lowercase for easier matching
    df.columns = [str(c).lower().strip() for c in df.columns]
    
    date_col = next((c for c in df.columns if 'date' in c), None)
    desc_col = next((c for c in df.columns if 'desc' in c or 'narration' in c or 'particular' in c or 'detail' in c or 'info' in c), None)
    
    credit_col = next((c for c in df.columns if 'credit' in c or 'deposit' in c), None)
    debit_col = next((c for c in df.columns if 'debit' in c or 'withdrawal' in c), None)
    amount_col = next((c for c in df.columns if 'amount' in c and 'balance' not in c), None)
    
    if not date_col or not desc_col:
        raise ValueError("Could not find required columns (Date, Description)")

    transactions = []
    for _, row in df.iterrows():
        if pd.isna(row.get(date_col)) or pd.isna(row.get(desc_col)):
            continue
            
        date_str = str(row[date_col]).strip()
        try:
            parsed_date = pd.to_datetime(date_str, dayfirst=True)
            if parsed_date.year < 1900 or parsed_date.year > 2100:
                continue
            parsed_date_str = parsed_date.strftime('%Y-%m-%d')
        except Exception:
            continue

        desc_raw = str(row[desc_col]).strip()
        
        amount = 0.0
        txn_type = TransactionType.DEBIT
        
        # Determine amount and type based on available columns
        if credit_col and debit_col:
            credit_val = row.get(credit_col)
            debit_val = row.get(debit_col)
            
            def safe_float(v):
                if pd.isna(v): return 0.0
                try:
                    return float(str(v).replace(',', '').strip())
                except:
                    return 0.0
                    
            c_amt = safe_float(credit_val)
            d_amt = safe_float(debit_val)
            
            if c_amt > 0:
                amount = c_amt
                txn_type = TransactionType.CREDIT
            elif d_amt > 0:
                amount = -d_amt
                txn_type = TransactionType.DEBIT
        elif amount_col:
            amount_val = row.get(amount_col)
            if not pd.isna(amount_val):
                try:
                    amount = float(str(amount_val).replace(',', '').strip())
                except:
                    amount = 0.0
                    
                if amount >= 0:
                    txn_type = TransactionType.CREDIT
                else:
                    txn_type = TransactionType.DEBIT

        if amount == 0.0:
            continue
            
        transactions.append(RawTransaction(
            date=parsed_date_str,
            description_raw=desc_raw,
            amount=amount,
            type=txn_type
        ))
        
    return transactions

def suggest_column_mapping(columns: List[str]) -> tuple[ColumnMapping, float]:
    """Suggest column mapping based on column names. Returns mapping and confidence score (0-1)."""
    columns_lower = [c.lower().strip() for c in columns]
    
    mapping = ColumnMapping()
    confidence_score = 0.0
    required_fields = 0
    matched_fields = 0
    
    # Date column patterns (high priority)
    date_patterns = ['date', 'transaction date', 'txn date', 'value date', 'posting date']
    for pattern in date_patterns:
        for i, col in enumerate(columns_lower):
            if pattern in col:
                mapping.date = columns[i]
                matched_fields += 1
                confidence_score += 0.3
                break
        if mapping.date:
            break
    
    # Description column patterns (high priority)
    desc_patterns = ['description', 'narration', 'particular', 'detail', 'info', 'transaction details', 'remarks', 'particulars', 'details']
    for pattern in desc_patterns:
        for i, col in enumerate(columns_lower):
            if pattern in col:
                mapping.description = columns[i]
                matched_fields += 1
                confidence_score += 0.3
                break
        if mapping.description:
            break
    
    # Debit column patterns
    debit_patterns = ['debit', 'withdrawal', 'withdraw', 'debit amount', 'dr', 'debit amt']
    for pattern in debit_patterns:
        for i, col in enumerate(columns_lower):
            if pattern in col and 'credit' not in col:
                mapping.debit = columns[i]
                matched_fields += 1
                confidence_score += 0.15
                break
        if mapping.debit:
            break
    
    # Credit column patterns
    credit_patterns = ['credit', 'deposit', 'credit amount', 'cr', 'credit amt']
    for pattern in credit_patterns:
        for i, col in enumerate(columns_lower):
            if pattern in col and 'debit' not in col:
                mapping.credit = columns[i]
                matched_fields += 1
                confidence_score += 0.15
                break
        if mapping.credit:
            break
    
    # Amount column patterns (single column for both)
    amount_patterns = ['amount', 'transaction amount', 'txn amount']
    for pattern in amount_patterns:
        for i, col in enumerate(columns_lower):
            if pattern in col and 'balance' not in col:
                mapping.amount = columns[i]
                matched_fields += 1
                confidence_score += 0.1
                break
        if mapping.amount:
            break
    
    # Balance column patterns
    balance_patterns = ['balance', 'closing balance', 'running balance', 'available balance']
    for pattern in balance_patterns:
        for i, col in enumerate(columns_lower):
            if pattern in col:
                mapping.balance = columns[i]
                matched_fields += 1
                confidence_score += 0.05
                break
        if mapping.balance:
            break
    
    # Calculate required fields (date and description are mandatory)
    required_fields = 2
    if mapping.date and mapping.description:
        confidence_score = min(confidence_score, 1.0)
    
    return mapping, confidence_score

def parse_csv_with_mapping(file_content: bytes, column_mapping: ColumnMapping, header_row: int = 0) -> List[TransactionBase]:
    """Parse CSV using explicit column mapping."""
    try:
        df = pd.read_csv(io.BytesIO(file_content), skiprows=header_row)
    except Exception as e:
        raise ValueError(f"Failed to read CSV: {str(e)}")
    
    # Make columns lowercase for easier matching
    df.columns = [str(c).strip() for c in df.columns]
    
    # Use provided mapping or fall back to auto-detection
    if not column_mapping.date or not column_mapping.description:
        auto_mapping = suggest_column_mapping(list(df.columns))
        if not column_mapping.date:
            column_mapping.date = auto_mapping.date
        if not column_mapping.description:
            column_mapping.description = auto_mapping.description
        if not column_mapping.debit:
            column_mapping.debit = auto_mapping.debit
        if not column_mapping.credit:
            column_mapping.credit = auto_mapping.credit
        if not column_mapping.amount:
            column_mapping.amount = auto_mapping.amount
        if not column_mapping.balance:
            column_mapping.balance = auto_mapping.balance
    
    if not column_mapping.date or not column_mapping.description:
        raise ValueError("Could not determine date and description columns. Please provide column mapping.")
    
    # Normalize column names to match dataframe
    def find_column(target: Optional[str]) -> Optional[str]:
        if not target:
            return None
        for col in df.columns:
            if col.lower() == target.lower() or target.lower() in col.lower():
                return col
        return None
    
    date_col = find_column(column_mapping.date)
    desc_col = find_column(column_mapping.description)
    credit_col = find_column(column_mapping.credit)
    debit_col = find_column(column_mapping.debit)
    amount_col = find_column(column_mapping.amount)
    balance_col = find_column(column_mapping.balance)
    
    if not date_col or not desc_col:
        raise ValueError(f"Could not find mapped columns: date={date_col}, description={desc_col}")
    
    transactions = []
    for _, row in df.iterrows():
        if pd.isna(row.get(date_col)) or pd.isna(row.get(desc_col)):
            continue
            
        date_str = str(row[date_col]).strip()
        try:
            parsed_date = pd.to_datetime(date_str, dayfirst=True)
            if parsed_date.year < 1900 or parsed_date.year > 2100:
                continue
            parsed_date_str = parsed_date.strftime('%Y-%m-%d')
        except Exception:
            continue

        desc_raw = str(row[desc_col]).strip()
        
        amount = 0.0
        txn_type = TransactionType.DEBIT
        balance_val = None
        
        # Determine amount and type based on available columns
        if credit_col and debit_col:
            credit_val = row.get(credit_col)
            debit_val = row.get(debit_col)
            
            def safe_float(v):
                if pd.isna(v): return 0.0
                try:
                    return float(str(v).replace(',', '').strip())
                except:
                    return 0.0
                    
            c_amt = safe_float(credit_val)
            d_amt = safe_float(debit_val)
            
            if c_amt > 0:
                amount = c_amt
                txn_type = TransactionType.CREDIT
            elif d_amt > 0:
                amount = -d_amt
                txn_type = TransactionType.DEBIT
        elif amount_col:
            amount_val = row.get(amount_col)
            if not pd.isna(amount_val):
                try:
                    amount = float(str(amount_val).replace(',', '').strip())
                except:
                    amount = 0.0
                    
                if amount >= 0:
                    txn_type = TransactionType.CREDIT
                else:
                    txn_type = TransactionType.DEBIT
        
        # Get balance if available
        if balance_col:
            balance_val = row.get(balance_col)
            if not pd.isna(balance_val):
                try:
                    balance_val = float(str(balance_val).replace(',', '').strip())
                except:
                    balance_val = None

        if amount == 0.0:
            continue
            
        transactions.append(RawTransaction(
            date=parsed_date_str,
            description_raw=desc_raw,
            amount=amount,
            type=txn_type,
            balance=balance_val
        ))
        
    return transactions

def preview_csv(file_content: bytes) -> Dict[str, Any]:
    """Preview CSV structure and suggest column mapping."""
    header_idx = find_header_row_index(file_content)
    
    try:
        df = pd.read_csv(io.BytesIO(file_content), skiprows=header_idx, nrows=5)
    except Exception as e:
        raise ValueError(f"Failed to read CSV: {str(e)}")
    
    columns = list(df.columns)
    sample_rows = df.head(3).to_dict('records')
    
    # Clean sample data for JSON serialization
    for row in sample_rows:
        for key, value in row.items():
            if pd.isna(value):
                row[key] = None
            elif isinstance(value, (pd.Timestamp, datetime)):
                row[key] = value.strftime('%Y-%m-%d')
            else:
                row[key] = str(value) if not pd.isna(value) else None
    
    suggested_mapping, confidence_score = suggest_column_mapping(columns)
    
    return {
        "columns": columns,
        "sample_rows": sample_rows,
        "suggested_mapping": suggested_mapping,
        "header_row": header_idx,
        "confidence_score": confidence_score,
        "auto_process": confidence_score >= 0.6  # Auto-process if confidence >= 60%
    }

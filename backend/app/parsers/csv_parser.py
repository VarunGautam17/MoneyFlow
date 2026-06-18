import pandas as pd
import io
import math
from datetime import datetime
from typing import List
from ..schemas import TransactionBase, TransactionType

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
        txn_type = TransactionType.debit
        
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
                txn_type = TransactionType.credit
            elif d_amt > 0:
                amount = -d_amt
                txn_type = TransactionType.debit
        elif amount_col:
            amount_val = row.get(amount_col)
            if not pd.isna(amount_val):
                try:
                    amount = float(str(amount_val).replace(',', '').strip())
                except:
                    amount = 0.0
                    
                if amount >= 0:
                    txn_type = TransactionType.credit
                else:
                    txn_type = TransactionType.debit

        if amount == 0.0:
            continue
            
        transactions.append(TransactionBase(
            date=parsed_date_str,
            description_raw=desc_raw,
            amount=amount,
            type=txn_type
        ))
        
    return transactions

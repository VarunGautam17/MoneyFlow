import re
from typing import List
from ..schemas import TransactionBase

def clean_description(raw_desc: str) -> str:
    # Basic rule-based cleaner
    desc = str(raw_desc).upper()
    # Remove noise like UPI/DR/123456
    desc = re.sub(r'UPI/(DR|CR)/[0-9]+/', '', desc)
    desc = re.sub(r'NEFT/.*?-', '', desc)
    desc = re.sub(r'IMPS/.*?-', '', desc)
    desc = re.sub(r'[^A-Z0-9\s]', ' ', desc)
    # Collapse whitespace
    desc = re.sub(r'\s+', ' ', desc).strip()
    return desc

def process_cleaning(transactions: List[TransactionBase]) -> List[TransactionBase]:
    for txn in transactions:
        txn.description_clean = clean_description(txn.description_raw)
    return transactions

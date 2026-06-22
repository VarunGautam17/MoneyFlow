import re
import csv
from datetime import datetime

SKIP_PATTERNS = re.compile(r"opening balance|closing balance|total", re.I)


def preprocess_csv_bytes(content: bytes) -> bytes:
    """
    Cleans up CSV content where entire lines might be wrapped in double quotes.
    e.g., "Date,Description,Transaction_Type,Debit,Credit,Balance"
    """
    if not content:
        return content

    # Detect encoding
    detected_encoding = "utf-8"
    if content.startswith(b'\xef\xbb\xbf'):
        detected_encoding = "utf-8-sig"
        try:
            text = content.decode("utf-8-sig")
        except Exception:
            text = content.decode("latin-1", errors="ignore")
            detected_encoding = "latin-1"
    else:
        try:
            text = content.decode("utf-8")
        except Exception:
            try:
                text = content.decode("latin-1")
                detected_encoding = "latin-1"
            except Exception:
                return content

    lines = text.splitlines()
    if not lines:
        return content

    changed = False
    new_lines = []
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            new_lines.append(line)
            continue
            
        try:
            # Parse line with CSV reader to see if it reads as a single field
            reader = csv.reader([stripped])
            row = next(reader)
            if len(row) == 1 and any(delim in row[0] for delim in (',', ';', '\t')):
                new_lines.append(row[0])
                changed = True
            else:
                new_lines.append(line)
        except Exception:
            new_lines.append(line)
            
    if not changed:
        return content
        
    try:
        return "\n".join(new_lines).encode(detected_encoding)
    except Exception:
        return content


def parse_amount(value: str) -> float | None:
    cleaned = value.strip().replace(",", "").replace("₹", "").replace("Rs.", "").replace("Rs", "")
    if not cleaned or cleaned == "-":
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_date(value: str) -> str | None:
    value = value.strip()
    if not value:
        return None
    for fmt in ("%d/%m/%y", "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%y", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    return None


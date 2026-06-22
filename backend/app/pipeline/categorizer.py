"""
Transaction categorizer: expanded regex rules → merchant dictionary → LLM fallback.

Strategy:
1. Regex rules  — high-confidence, broad keyword patterns (Indian-specific)
2. Merchant dict — curated merchant → category mapping with aliases
3. LLM fallback  — Groq handles anything still marked OTHER (confidence = 0)
                   AND low-confidence dict matches (confidence < DICT_CONFIDENCE)
                   to maximise accuracy without wasting token budget on sure matches.
"""

import json
import re
from pathlib import Path

from app.models.enums import Category
from app.pipeline.cleaner import CleanedTransaction
from app.services.llm import categorize_with_llm, get_llm_service

RULE_CONFIDENCE = 0.95   # regex keyword match — very reliable
DICT_CONFIDENCE = 0.85   # known merchant dict match
LLM_CONFIDENCE  = 0.78   # Groq result (set inside llm.py, mirrored here for clarity)
DEFAULT_CONFIDENCE = 0.0  # unmatched → sent to LLM

# ---------------------------------------------------------------------------
# Expanded regex rules — ordered from most-specific to most-general
# Each pattern is compiled once at import time for speed.
# ---------------------------------------------------------------------------
CATEGORY_RULES: list[tuple[re.Pattern[str], Category]] = [

    # ── Salary / Income ─────────────────────────────────────────────────────
    (re.compile(
        r"\b(SALARY|PAYROLL|STIPEND|WAGES|SALCREDIT|SAL CREDIT"
        r"|NEFT CR|IMPS CR|SALARY TRANSFER|EMPLOYER|HIKE|BONUS"
        r"|FREELANCE|CONSULTING FEE|CONTRACT PAY|HONORARIUM)\b",
        re.I,
    ), Category.SALARY),

    # ── Credit Card repayment ────────────────────────────────────────────────
    # Matches: "CRED" (whole word), "CHEQ", "CC BILL", "CC PAYMENT"
    # Does NOT match: "CREDIT", "CREDITED", "UPI CREDIT" (credit = incoming money)
    (re.compile(
        r"(?:\bCRED\b|\bCHEQ\b|\bCC\s+BILL\b|\bCC\s+PAYMENT\b|\bCREDIT\s+CARD\s+BILL\b|\bCREDIT\s+CARD\s+PAYMENT\b)",
        re.I,
    ), Category.CREDIT_CARD),

    # ── Food & Groceries ────────────────────────────────────────────────────
    (re.compile(
        r"\b(SWIGGY|ZOMATO|DOMINOS?|PIZZA HUT|PIZZAHUT|KFC|MCDONALDS?|MCD"
        r"|BURGER KING|BURGERKING|SUBWAY|STARBUCKS|CAFE|CAFÉ|CHAAYOS"
        r"|HALDIRAMS?|NATURALS?|BLINKIT|BIGBASKET|BB DAILY|BB NOW|ZEPTO"
        r"|DUNZO|MILKBASKET|FRESH TO HOME|FRESHTOHOME|LICIOUS|FAASOS|BOX8"
        r"|RESTAURANT|EATERY|BAKERY|DHABA|FOOD|DINING|DINER|CANTEEN|MESS"
        r"|KITCHEN|TIFFIN|HOTEL FOOD|SWEETS|MITHAI|JUICE|LASSI|CHAI|TEA"
        r"|COFFEE|BREAD|DAIRY|GROCERY|GROCERIES|SUPERMARKET|KIRANA"
        r"|PROVISION|VEGETABLES|FRUITS|ORGANIC|AMUL|MOTHER DAIRY|FRESHO)\b",
        re.I,
    ), Category.FOOD),

    # ── Travel & Transport ──────────────────────────────────────────────────
    (re.compile(
        r"\b(UBER|OLA|RAPIDO|MERU|IRCTC|MAKEMYTRIP|MMT|GOIBIBO|EASEMYTRIP"
        r"|YATRA|REDBUS|ABHIBUS|INDIGO|AIR INDIA|SPICEJET|VISTARA|AKASA"
        r"|AIRINDIA|INTERGLOBE|CAB|TAXI|AUTO|METRO|DMRC|BMRCL|BMTC"
        r"|TRAIN|RAILWAY|FLIGHT|AIRLINE|BUS|TICKET|BOARDING|FASTAG"
        r"|PETROL|FUEL|GAS STATION|HPCL|BPCL|IOCL|HP PETROL|INDIAN OIL"
        r"|BHARAT PETROLEUM|TOLL|PARKING|TRANSPORT|TRAVEL|TRIP|COMMUTE)\b",
        re.I,
    ), Category.TRAVEL),

    # ── Shopping ────────────────────────────────────────────────────────────
    (re.compile(
        r"\b(AMAZON|FLIPKART|MYNTRA|AJIO|NYKAA|MEESHO|SNAPDEAL|FIRSTCRY"
        r"|PEPPERFRY|URBANLADDER|URBAN LADDER|IKEA|CROMA|RELIANCE DIGITAL"
        r"|VIJAY SALES|DMART|D MART|AVENUE SUPERMARTS|RELIANCE FRESH"
        r"|RELIANCE SMART|MORE SUPERMARKET|VISHAL MEGA MART|DECATHLON"
        r"|H&M|ZARA|INDITEX|MAX FASHION|PANTALOONS|SHOPPERS STOP|LIFESTYLE"
        r"|LENSKART|CLOVIA|MALL|RETAIL|SHOP|STORE|BAZAAR|CASHBACK)\b",
        re.I,
    ), Category.SHOPPING),

    # ── Bills & Utilities ───────────────────────────────────────────────────
    (re.compile(
        r"\b(AIRTEL|JIO|BSNL|VODAFONE|VI\b|BESCOM|MSEDCL|TATA POWER|TORRENT POWER"
        r"|MAHANAGAR GAS|MGL\b|IGL\b|ADANI GAS|DISH TV|TATA SKY|TATA PLAY"
        r"|SUN DIRECT|HATHWAY|ACT FIBERNET|ACT BROADBAND|EXCITEL"
        r"|LIC|ICICI PRU|HDFC LIFE|SBI LIFE|BAJAJ ALLIANZ|MAX LIFE|NAVI"
        r"|STAR HEALTH|ELECTRICITY|WATER BILL|GAS BILL|INTERNET BILL"
        r"|BROADBAND|MOBILE BILL|TELEPHONE|RECHARGE|DTH|INSURANCE|PREMIUM"
        r"|SMS CHARGES?|TAX|CHARGES|UTILITY|BBPS|BILL PAYMENT)\b",
        re.I,
    ), Category.BILLS),

    # ── Subscriptions ───────────────────────────────────────────────────────
    (re.compile(
        r"\b(NETFLIX|SPOTIFY|YOUTUBE PREMIUM|YOUTUBE MUSIC|PRIME VIDEO"
        r"|HOTSTAR|DISNEY|SONYLIV|SONY LIV|VOOT|ZEE5|MX PLAYER"
        r"|APPLE MUSIC|APPLE ONE|APPLE TV|ITUNES|GAANA|JIOSAAVN|JIO SAAVN"
        r"|CULT FIT|CUREFIT|CURE FIT|GOLD GYM|GOLDS GYM|ANYTIME FITNESS"
        r"|GYM|FITNESS|MEMBERSHIP|SUBSCRIPTION|OTT|CLUB|ANNUAL FEE)\b",
        re.I,
    ), Category.SUBSCRIPTIONS),

    # ── EMI / Loan repayments ───────────────────────────────────────────────
    (re.compile(
        r"\b(HOME LOAN|CAR LOAN|VEHICLE LOAN|PERSONAL LOAN|EDUCATION LOAN"
        r"|STUDY LOAN|BAJAJ FINANCE|BAJAJ FINSERV|EMI|LOAN|MORTGAGE"
        r"|INSTALLMENT|INSTALMENT|REPAYMENT|NACH DEBIT|ECS DEBIT|SI DEBIT"
        r"|STANDING INSTRUCTION|ACH|ACH DEBIT)\b",
        re.I,
    ), Category.EMI),

    # ── Rent ────────────────────────────────────────────────────────────────
    (re.compile(
        r"\b(RENT|NOBROKER|NO BROKER|HOUSE RENT|HOME RENT|FLAT RENT"
        r"|LEASE|MAGICBRICKS|99ACRES|PG RENT|ACCOMMODATION|LANDLORD"
        r"|PROPERTY|PAYING GUEST)\b",
        re.I,
    ), Category.RENT),

    # ── Investments ─────────────────────────────────────────────────────────
    (re.compile(
        r"\b(ZERODHA|GROWW|UPSTOX|RKSV|ANGEL ONE|ANGEL BROKING|ANGELONE"
        r"|EDELWEISS|MOTILAL OSWAL|PAYTM MONEY|KOTAK SECURITIES"
        r"|HDFC SECURITIES|ICICI DIRECT|KUVERA|SIP|MUTUAL FUND"
        r"|STOCK|SHARES|SECURITIES|INVEST|INVESTMENT|DEPOSIT|FD|RD"
        r"|REDEMPTION|NSE|BSE|DEMAT|NSDL|CDSL|PORTFOLIO)\b",
        re.I,
    ), Category.INVESTMENTS),
]


# ---------------------------------------------------------------------------
# Merchant dictionary (loaded once)
# ---------------------------------------------------------------------------

def _load_merchant_categories() -> list[tuple[str, Category]]:
    path = Path(__file__).resolve().parent.parent / "data" / "merchants.json"
    with path.open() as f:
        merchants = json.load(f)["merchants"]
    mapping: list[tuple[str, Category]] = []
    for name, info in merchants.items():
        cat = Category(info["category"])
        mapping.append((name.upper(), cat))
        for alias in info.get("aliases", []):
            mapping.append((alias.upper(), cat))
    # Longer keys matched first to avoid partial false-positives
    mapping.sort(key=lambda x: len(x[0]), reverse=True)
    return mapping


_MERCHANT_CACHE: list[tuple[str, Category]] | None = None


def _get_merchants() -> list[tuple[str, Category]]:
    global _MERCHANT_CACHE
    if _MERCHANT_CACHE is None:
        _MERCHANT_CACHE = _load_merchant_categories()
    return _MERCHANT_CACHE


# ---------------------------------------------------------------------------
# Single-transaction categorizer
# ---------------------------------------------------------------------------

def categorize_transaction(txn: CleanedTransaction) -> tuple[Category, float]:
    """Rules → dict → (OTHER, 0.0) for LLM."""
    text = f"{txn.description_raw} {txn.description_clean}".upper()

    # Layer 1: Regex rules
    for pattern, category in CATEGORY_RULES:
        if pattern.search(text):
            return category, RULE_CONFIDENCE

    # Layer 2: Merchant dictionary
    for keyword, category in _get_merchants():
        if keyword in text:
            return category, DICT_CONFIDENCE

    # Layer 3: Credit-specific heuristics
    if txn.type.value == "credit":
        if re.search(r"\bSALARY\b", text):
            return Category.SALARY, RULE_CONFIDENCE
        if re.search(r"\bREDEMPTION\b", text):
            return Category.INVESTMENTS, DICT_CONFIDENCE

    return Category.OTHER, DEFAULT_CONFIDENCE


# ---------------------------------------------------------------------------
# Batch categorizer — combines rule/dict results with LLM for low-confidence
# ---------------------------------------------------------------------------

def categorize_transactions(
    transactions: list[CleanedTransaction],
    txn_ids: list[str] | None = None,
) -> list[tuple[CleanedTransaction, Category, float]]:
    """
    Categorize all transactions using a three-stage hybrid pipeline:

    Stage 1 — Rules + dictionary for all transactions.
    Stage 2 — LLM is called for:
               a) Unmatched transactions (confidence == 0, category == OTHER)
               b) Low-confidence dict matches (confidence < DICT_CONFIDENCE)
                  where the description is ambiguous
    Stage 3 — LLM result replaces rule/dict result when it returns a
              non-OTHER category; otherwise rule/dict result is kept.
    """
    results: list[tuple[CleanedTransaction, Category, float]] = []
    # Collect indices of txns to send to LLM
    llm_candidates: list[tuple[str, CleanedTransaction, int]] = []  # (id, txn, result_index)

    for i, txn in enumerate(transactions):
        category, confidence = categorize_transaction(txn)
        results.append((txn, category, confidence))
        txn_id = txn_ids[i] if txn_ids and i < len(txn_ids) else str(i)

        # Send to LLM if unmatched OR dict-confidence (LLM may improve accuracy)
        if confidence <= DICT_CONFIDENCE:
            llm_candidates.append((txn_id, txn, i))

    if llm_candidates:
        llm_input = [(tid, txn) for tid, txn, _ in llm_candidates]
        llm_results = categorize_with_llm(llm_input, get_llm_service())

        for txn_id, txn, idx in llm_candidates:
            if txn_id not in llm_results:
                continue
            llm_cat, llm_conf = llm_results[txn_id]
            # Accept LLM result if it's more specific than OTHER,
            # or if current result is already OTHER
            current_cat = results[idx][1]
            if llm_cat != Category.OTHER or current_cat == Category.OTHER:
                results[idx] = (txn, llm_cat, llm_conf)

    return results

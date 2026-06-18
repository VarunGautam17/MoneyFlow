from typing import List
from ..schemas import TransactionBase

# Simple keyword rules
RULES = {
    "SALARY": "Salary",
    "NETFLIX": "Subscriptions",
    "SPOTIFY": "Subscriptions",
    "SWIGGY": "Food",
    "ZOMATO": "Food",
    "DOMINOS": "Food",
    "UBER": "Travel",
    "OLA": "Travel",
    "IRCTC": "Travel",
    "MAKEMYTRIP": "Travel",
    "SIP": "Investments",
    "ZERODHA": "Investments",
    "GROWW": "Investments",
    "HOME LOAN": "EMI",
    "EMI": "EMI",
    "AMAZON": "Shopping",
    "FLIPKART": "Shopping"
}

def categorize_transaction(desc_clean: str, amount: float) -> str:
    if not desc_clean:
        return "Other"
        
    for keyword, category in RULES.items():
        if keyword in desc_clean:
            return category
            
    return "Other"

def process_categorization(transactions: List[TransactionBase]) -> List[TransactionBase]:
    # 1. First apply simple keyword rules
    unmatched_indices = []
    for idx, txn in enumerate(transactions):
        txn.category = categorize_transaction(txn.description_clean, txn.amount)
        if txn.category == "Other":
            unmatched_indices.append(idx)
        else:
            txn.category_confidence = 0.8
            
    # 2. If there are unmatched transactions, attempt LLM categorization
    if unmatched_indices:
        # Prepare payload for LLM
        llm_input = []
        for idx in unmatched_indices:
            txn = transactions[idx]
            llm_input.append({
                "id": str(idx),
                "description_clean": txn.description_clean,
                "amount": txn.amount,
                "type": txn.type.value if hasattr(txn.type, "value") else str(txn.type)
            })
            
        # Call LLM client
        try:
            from ..services.llm import categorize_transactions_llm
            llm_results = categorize_transactions_llm(llm_input)
            
            # Map LLM results back to transactions
            for idx_str, result in llm_results.items():
                try:
                    idx = int(idx_str)
                    if idx in unmatched_indices:
                        transactions[idx].category = result["category"]
                        transactions[idx].category_confidence = result["confidence"]
                except (ValueError, KeyError):
                    continue
        except Exception:
            # Graceful degradation: skip LLM and let it fall back to Other
            pass
            
    # 3. For any transaction that is still "Other", set default confidence
    for txn in transactions:
        if txn.category == "Other" or txn.category is None:
            txn.category = "Other"
            txn.category_confidence = 0.4
            
    return transactions


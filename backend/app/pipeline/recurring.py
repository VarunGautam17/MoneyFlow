import uuid
import difflib
from datetime import datetime
from typing import List, Dict, Any

def get_similarity(s1: str, s2: str) -> float:
    if not s1 or not s2:
        return 0.0
    return difflib.SequenceMatcher(None, s1, s2).ratio()

def detect_recurring_groups(transactions: List[Any]) -> List[Dict[str, Any]]:
    # 1. Filter out only debits (amount < 0) and exclude non-recurring categories (Food, Travel, Shopping)
    EXCLUDED_CATEGORIES = {"Food", "Travel", "Shopping"}
    debits = [
        t for t in transactions 
        if t.amount < 0 and (t.category not in EXCLUDED_CATEGORIES)
    ]
    if not debits:
        return []
        
    # 2. Group transactions into clusters of similar cleaned descriptions
    clusters: List[List[Any]] = []
    for txn in debits:
        desc = txn.description_clean or txn.description_raw or ""
        matched = False
        for cluster in clusters:
            first_desc = cluster[0].description_clean or cluster[0].description_raw or ""
            if get_similarity(desc, first_desc) >= 0.6:
                cluster.append(txn)
                matched = True
                break
        if not matched:
            clusters.append([txn])
            
    detected_groups = []
    
    # 3. Analyze each cluster to see if there's a recurring pattern
    for cluster in clusters:
        if len(cluster) < 2:
            continue
            
        # Sort by date
        sorted_txns = sorted(cluster, key=lambda t: t.date)
        
        matching_indices = set()
        for i in range(len(sorted_txns)):
            date_i = datetime.strptime(sorted_txns[i].date, "%Y-%m-%d")
            amt_i = abs(sorted_txns[i].amount)
            for j in range(i + 1, len(sorted_txns)):
                date_j = datetime.strptime(sorted_txns[j].date, "%Y-%m-%d")
                amt_j = abs(sorted_txns[j].amount)
                
                days = (date_j - date_i).days
                amt_diff = abs(amt_i - amt_j) / max(amt_i, amt_j) if max(amt_i, amt_j) > 0 else 0.0
                
                # Check monthly interval (~25-35 days) and amount tolerance (5%)
                if 25 <= days <= 35 and amt_diff <= 0.05:
                    matching_indices.add(i)
                    matching_indices.add(j)
                    
        if len(matching_indices) >= 2:
            matched_txns = [sorted_txns[idx] for idx in sorted(list(matching_indices))]
            
            # Generate UUID for this group
            group_id = str(uuid.uuid4())
            
            # Mark the transactions
            for txn in matched_txns:
                txn.is_recurring = True
                txn.recurring_group_id = group_id
                
            # Calculate typical amount
            typical_amount = sum(abs(t.amount) for t in matched_txns) / len(matched_txns)
            
            # Derive name
            raw_name = matched_txns[0].description_clean or matched_txns[0].description_raw or "Recurring Payment"
            name_parts = [p.capitalize() for p in raw_name.split() if p]
            name = " ".join(name_parts)
            
            # Category is the most frequent category among matched transactions
            categories = [t.category for t in matched_txns if t.category]
            category = max(set(categories), key=categories.count) if categories else "Other"
            
            # Confidence score
            confidence = 0.80 if len(matched_txns) == 2 else 0.95
            
            group_data = {
                "id": group_id,
                "name": name,
                "typical_amount": round(typical_amount, 2),
                "frequency": "monthly",
                "confidence": confidence,
                "category": category,
                "transactions": matched_txns
            }
            detected_groups.append(group_data)
            
    return detected_groups

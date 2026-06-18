from typing import List, Dict, Any
from ..schemas import TransactionBase

def calculate_metrics(transactions: List[Any], recurring_groups: List[Any] = None) -> Dict[str, Any]:
    if recurring_groups is None:
        recurring_groups = []
        
    income = sum(t.amount for t in transactions if t.amount > 0)
    spend = sum(abs(t.amount) for t in transactions if t.amount < 0)
    savings = income - spend
    savings_rate = (savings / income * 100) if income > 0 else 0.0

    # Top categories
    category_spend = {}
    for t in transactions:
        if t.amount < 0:
            cat = t.category or "Other"
            category_spend[cat] = category_spend.get(cat, 0.0) + abs(t.amount)
            
    top_categories = [{"category": k, "amount": v} for k, v in sorted(category_spend.items(), key=lambda item: item[1], reverse=True)]
    
    # Biggest transactions
    debits = [t for t in transactions if t.amount < 0]
    biggest_transactions = []
    if debits:
        biggest_txn = min(debits, key=lambda t: t.amount)
        biggest_transactions.append({
            "description": biggest_txn.description_clean or biggest_txn.description_raw,
            "amount": abs(biggest_txn.amount),
            "date": biggest_txn.date
        })

    # Recurring calculations
    def get_typical_amount(g):
        if isinstance(g, dict):
            return g["typical_amount"]
        return getattr(g, "typical_amount", 0.0)
        
    recurring_total = sum(get_typical_amount(g) for g in recurring_groups)

    # Monthly spend aggregation
    monthly_spend_map = {}
    for t in transactions:
        if t.amount < 0:
            month = t.date[:7]
            monthly_spend_map[month] = monthly_spend_map.get(month, 0.0) + abs(t.amount)
            
    monthly_spend = [{"month": k, "spend": round(v, 2)} for k, v in sorted(monthly_spend_map.items())]

    # Basic Insights
    insights = []
    if top_categories:
        top_cat = top_categories[0]
        insights.append(f"You spent ₹{top_cat['amount']:,.2f} on {top_cat['category']} this month — your largest category.")
    if biggest_transactions:
        biggest = biggest_transactions[0]
        insights.append(f"Your biggest transaction was ₹{biggest['amount']:,.2f} to {biggest['description']} on {biggest['date']}.")
    if recurring_groups:
        insights.append(f"{len(recurring_groups)} recurring payments totalling ₹{recurring_total:,.2f}/month")
        
    try:
        from ..services.llm import generate_narrative_insights_llm
        llm_insights = generate_narrative_insights_llm(
            income=income,
            spend=spend,
            savings=savings,
            savings_rate=savings_rate,
            top_categories=top_categories,
            biggest_transactions=biggest_transactions,
            recurring_groups=recurring_groups
        )
        if llm_insights:
            insights.extend(llm_insights)
    except Exception:
        pass
        
    return {
        "metrics": {
            "income": income,
            "spend": spend,
            "savings": savings,
            "savings_rate": savings_rate,
            "recurring_total": recurring_total,
            "monthly_spend": monthly_spend
        },
        "top_categories": top_categories[:5], # top 5
        "biggest_transactions": biggest_transactions,
        "insights": insights
    }


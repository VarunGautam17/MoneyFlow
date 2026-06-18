import json
import urllib.request
import urllib.error
import logging
import time
from typing import List, Dict, Any
from ..config import settings

logger = logging.getLogger(__name__)

VALID_CATEGORIES = {"Salary", "Subscriptions", "Food", "Travel", "Investments", "EMI", "Shopping", "Other"}

def clean_json_string(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        first_line = s.find("\n")
        if first_line != -1:
            s = s[first_line:]
        if s.endswith("```"):
            s = s[:-3]
    return s.strip()

def categorize_transactions_llm(transactions: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    Sends a batch of transactions to the LLM (Groq) for categorization.
    Each transaction in the list should have:
    - id
    - description_clean
    - amount
    - type (credit/debit)
    
    Returns a dict mapping transaction ID to categorization info:
    {
        "txn_id": {
            "category": "Food",
            "confidence": 0.85
        }
    }
    """
    api_key = settings.LLM_API_KEY or settings.GROQ_API_KEY
    if not api_key:
        logger.info("No LLM/Groq API key found. Skipping LLM categorization.")
        return {}
        
    if not transactions:
        return {}
        
    model = settings.GROQ_MODEL or "llama-3.3-70b-versatile"
    url = "https://api.groq.com/openai/v1/chat/completions"
    
    results = {}
    
    # Batch transactions in sizes of 15 to stay strictly under the 1K TPM limit
    batch_size = 15
    for i in range(0, len(transactions), batch_size):
        start_time = time.time()
        batch = transactions[i:i + batch_size]
        
        prompt = (
            "You are a personal finance assistant that categorizes bank transactions.\n"
            "Analyze the following list of transactions and categorize each one into exactly one of these allowed categories:\n"
            f"{', '.join(sorted(list(VALID_CATEGORIES)))}\n\n"
            "Transaction list (JSON array of objects, each with 'id', 'description_clean', 'amount', 'type'):\n"
            f"{json.dumps(batch, indent=2)}\n\n"
            "Return a JSON object containing a 'categories' list of objects. Each object must have:\n"
            "- 'id': string, corresponding to the input transaction ID\n"
            "- 'category': string, which MUST be one of the allowed categories above\n"
            "- 'confidence': float, confidence score between 0.0 and 1.0\n\n"
            "Output ONLY valid JSON. No conversational text, no markdown code block backticks (like ```json), just raw JSON."
        )
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0"
        }
        
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a precise data labeling system that outputs strict JSON formats only."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.0,
            "response_format": {"type": "json_object"}
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                resp_data = json.loads(response.read().decode("utf-8"))
                
            content_str = resp_data["choices"][0]["message"]["content"].strip()
            content_str = clean_json_string(content_str)
            content = json.loads(content_str)
            
            # Map classifications
            for item in content.get("categories", []):
                txn_id = item.get("id")
                category = item.get("category")
                confidence = item.get("confidence", 0.5)
                
                # Validation
                if category not in VALID_CATEGORIES:
                    category = "Other"
                    
                if txn_id:
                    results[txn_id] = {
                        "category": category,
                        "confidence": float(confidence)
                    }
                    
            # Throttling to respect RPM / TPM limits
            usage = resp_data.get("usage", {})
            total_tokens = usage.get("total_tokens", 0)
            if total_tokens == 0:
                # Fallback token estimate (~4 characters per token)
                total_tokens = (len(prompt) + len(content_str)) // 4
                
            elapsed = time.time() - start_time
            # 15,000 tokens per minute = 250 tokens per second
            budget_duration = (total_tokens / 15000.0) * 60.0
            sleep_time = min(2.0, max(0.0, budget_duration - elapsed))
            
            logger.info(f"LLM Batch {i//batch_size + 1} processed. Tokens: {total_tokens}. Elapsed: {elapsed:.2f}s. Throttling for {sleep_time:.2f}s to respect 15K TPM limit.")
            
            if sleep_time > 0 and (i + batch_size < len(transactions)):
                time.sleep(sleep_time)
                    
        except Exception as e:
            logger.error(f"Error during LLM batch categorization: {e}")
            # In case of error, sleep a bit to prevent tight loop errors
            time.sleep(1.0)
            continue
            
    return results

def generate_narrative_insights_llm(
    income: float,
    spend: float,
    savings: float,
    savings_rate: float,
    top_categories: List[Dict[str, Any]],
    biggest_transactions: List[Dict[str, Any]],
    recurring_groups: List[Any]
) -> List[str]:
    api_key = settings.LLM_API_KEY or settings.GROQ_API_KEY
    if not api_key:
        return []

    top_cats_str = "\n".join([f"- {c.get('category', 'Other')}: INR {c.get('amount', 0.0):.2f}" for c in top_categories if isinstance(c, dict)])
    biggest_txns_str = "\n".join([f"- {t.get('description', 'Unknown')} on {t.get('date', 'Unknown')}: INR {t.get('amount', 0.0):.2f}" for t in biggest_transactions if isinstance(t, dict)])
    
    recurring_items = []
    for r in recurring_groups:
        if isinstance(r, dict):
            name = r.get("name", r.get("category", "Recurring"))
            amount = r.get("typical_amount", 0.0)
            freq = r.get("frequency", "monthly")
        else:
            name = getattr(r, "name", getattr(r, "category", "Recurring"))
            amount = getattr(r, "typical_amount", 0.0)
            freq = getattr(r, "frequency", "monthly")
        recurring_items.append(f"- {name}: INR {amount:.2f} ({freq})")
    recurring_str = "\n".join(recurring_items)

    prompt = (
        "You are an expert personal finance assistant.\n"
        "Analyze the following financial summary for a user and generate exactly 3 highly personalized, actionable narrative insights.\n"
        "Keep each insight under 25 words. Do not use generic advice; reference specific amounts, categories, and trends from the data.\n\n"
        "Financial Data:\n"
        f"- Total Income: INR {income:.2f}\n"
        f"- Total Spend: INR {spend:.2f}\n"
        f"- Net Savings: INR {savings:.2f} (Savings Rate: {savings_rate:.1f}%)\n"
        f"Top Categories:\n{top_cats_str}\n"
        f"Biggest Transactions:\n{biggest_txns_str}\n"
        f"Recurring Transactions:\n{recurring_str}\n\n"
        "Return a JSON object containing an 'insights' list of strings. Each string must be a concise narrative insight.\n"
        "Output ONLY valid JSON. No conversational text, no markdown code block backticks (like ```json), just raw JSON."
    )

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
    }
    payload = {
        "model": settings.GROQ_MODEL or "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": "You are a personal finance analysis system that outputs strict JSON formats only."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.5,
        "response_format": {"type": "json_object"}
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            resp_data = json.loads(response.read().decode("utf-8"))
        content_str = resp_data["choices"][0]["message"]["content"].strip()
        content_str = clean_json_string(content_str)
        content = json.loads(content_str)
        return content.get("insights", [])
    except Exception as e:
        logger.error(f"Error during LLM narrative insight generation: {e}")
        return []


import os
import sys

# Add backend directory to sys.path so we can import app modules
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.parsers.csv_parser import parse_generic_csv
from app.pipeline.cleaner import process_cleaning
from app.pipeline.categorizer import process_categorization
from app.pipeline.metrics import calculate_metrics

def main():
    fixture_path = os.path.join(backend_dir, "tests", "fixtures", "sample_hdfc.csv")
    print(f"Reading fixture from {fixture_path}...")
    
    with open(fixture_path, "rb") as f:
        file_content = f.read()
        
    print("Parsing CSV...")
    transactions = parse_generic_csv(file_content)
    print(f"Parsed {len(transactions)} transactions.")
    
    # Assertions on parsing
    assert len(transactions) > 0, "No transactions parsed!"
    for txn in transactions:
        assert txn.date is not None
        assert txn.description_raw is not None
        assert txn.amount != 0.0
        assert txn.type is not None

    print("Cleaning transactions...")
    cleaned = process_cleaning(transactions)
    
    print("Categorizing transactions...")
    categorized = process_categorization(cleaned)
    
    print("Calculating metrics...")
    metrics_data = calculate_metrics(categorized)
    
    metrics = metrics_data["metrics"]
    print("\n--- Metrics Summary ---")
    print(f"Income: Rs. {metrics['income']:,.2f}")
    print(f"Spend:  Rs. {metrics['spend']:,.2f}")
    print(f"Savings: Rs. {metrics['savings']:,.2f}")
    print(f"Savings Rate: {metrics['savings_rate']:.2f}%")
    
    print("\n--- Top Categories ---")
    for cat in metrics_data["top_categories"]:
        print(f"{cat['category']}: Rs. {cat['amount']:,.2f}")
        
    print("\n--- Biggest Transactions ---")
    for t in metrics_data["biggest_transactions"]:
        print(f"{t['description']} on {t['date']}: Rs. {t['amount']:,.2f}")

    print("\n--- Generated Insights ---")
    for insight in metrics_data["insights"]:
        print(f"- {insight.replace('₹', 'Rs. ')}")
        
    # Some basic checks to verify the fixture calculations are correct
    assert metrics["income"] == 302050.0, f"Expected 302,050 income, got {metrics['income']}"
    assert len(metrics_data["top_categories"]) > 0
    assert len(metrics_data["insights"]) > 0
    
    print("\nAll pipeline verification checks passed successfully!")

if __name__ == "__main__":
    main()

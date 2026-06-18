import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.pipeline.recurring import detect_recurring_groups

class MockTransaction:
    def __init__(self, date, desc_raw, desc_clean, amount, category):
        self.date = date
        self.description_raw = desc_raw
        self.description_clean = desc_clean
        self.amount = amount
        self.category = category
        self.is_recurring = False
        self.recurring_group_id = None

def test_recurring_detection():
    txns = [
        # Rent (recurring)
        MockTransaction("2026-06-02", "UPI/DR/11111/HOUSE_OWNER", "HOUSE OWNER", -35000.0, "Other"),
        MockTransaction("2026-07-02", "UPI/DR/11111/HOUSE_OWNER", "HOUSE OWNER", -35000.0, "Other"),
        
        # Spotify (recurring)
        MockTransaction("2026-06-04", "IMPS-654321-SPOTIFY-Spotify Premium", "SPOTIFY", -119.0, "Subscriptions"),
        MockTransaction("2026-07-04", "IMPS-654321-SPOTIFY-Spotify Premium", "SPOTIFY", -119.0, "Subscriptions"),
        
        # Swiggy (excluded category, should NOT be recurring)
        MockTransaction("2026-06-15", "UPI/DR/12345/SWIGGY", "SWIGGY", -380.0, "Food"),
        MockTransaction("2026-07-15", "UPI/DR/12345/SWIGGY", "SWIGGY", -380.0, "Food"),
    ]
    
    groups = detect_recurring_groups(txns)
    
    # Assertions
    assert len(groups) == 2, f"Expected 2 groups, got {len(groups)}"
    
    group_names = {g["name"] for g in groups}
    assert "House Owner" in group_names, f"Expected House Owner in groups, got {group_names}"
    assert "Spotify" in group_names, f"Expected Spotify in groups, got {group_names}"
    
    # Verify Swiggy txn is not recurring
    swiggy_txns = [t for t in txns if t.description_clean == "SWIGGY"]
    for t in swiggy_txns:
        assert not t.is_recurring, "Swiggy transaction should not be flagged as recurring!"
        assert t.recurring_group_id is None
        
    # Verify Rent typical amount
    rent_group = next(g for g in groups if g["name"] == "House Owner")
    assert rent_group["typical_amount"] == 35000.0
    assert rent_group["confidence"] == 0.80 # 2 occurrences
    
    print("All recurring detection tests passed successfully!")

if __name__ == "__main__":
    test_recurring_detection()

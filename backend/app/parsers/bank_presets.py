from ..schemas import BankPreset, ColumnMapping

# Common Indian bank presets
BANK_PRESETS: list[BankPreset] = [
    BankPreset(
        name="HDFC Bank",
        code="hdfc",
        column_mapping=ColumnMapping(
            date="Date",
            description="Narration",
            debit="Debit",
            credit="Credit",
            amount=None,
            balance="Balance"
        ),
        date_format="%d/%m/%Y"
    ),
    BankPreset(
        name="ICICI Bank",
        code="icici",
        column_mapping=ColumnMapping(
            date="Date",
            description="Description",
            debit="Debit",
            credit="Credit",
            amount=None,
            balance="Balance"
        ),
        date_format="%d/%m/%Y"
    ),
    BankPreset(
        name="State Bank of India",
        code="sbi",
        column_mapping=ColumnMapping(
            date="Date",
            description="Description",
            debit="Debit",
            credit="Credit",
            amount=None,
            balance="Balance"
        ),
        date_format="%d-%m-%Y"
    ),
    BankPreset(
        name="Axis Bank",
        code="axis",
        column_mapping=ColumnMapping(
            date="Date",
            description="Description",
            debit="Debit",
            credit="Credit",
            amount=None,
            balance="Balance"
        ),
        date_format="%d/%m/%Y"
    ),
    BankPreset(
        name="Kotak Mahindra Bank",
        code="kotak",
        column_mapping=ColumnMapping(
            date="Date",
            description="Description",
            debit="Debit",
            credit="Credit",
            amount=None,
            balance="Balance"
        ),
        date_format="%d/%m/%Y"
    ),
    BankPreset(
        name="Punjab National Bank",
        code="pnb",
        column_mapping=ColumnMapping(
            date="Date",
            description="Description",
            debit="Debit",
            credit="Credit",
            amount=None,
            balance="Balance"
        ),
        date_format="%d-%m-%Y"
    ),
    BankPreset(
        name="Bank of Baroda",
        code="bob",
        column_mapping=ColumnMapping(
            date="Date",
            description="Description",
            debit="Debit",
            credit="Credit",
            amount=None,
            balance="Balance"
        ),
        date_format="%d/%m/%Y"
    ),
    BankPreset(
        name="Generic (Auto-detect)",
        code="generic",
        column_mapping=ColumnMapping(
            date=None,
            description=None,
            debit=None,
            credit=None,
            amount=None,
            balance=None
        ),
        date_format=None
    )
]

def get_bank_preset(code: str) -> BankPreset | None:
    """Get bank preset by code."""
    for preset in BANK_PRESETS:
        if preset.code == code:
            return preset
    return None

def get_all_bank_presets() -> list[BankPreset]:
    """Get all available bank presets."""
    return BANK_PRESETS

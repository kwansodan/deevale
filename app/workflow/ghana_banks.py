"""Ghanaian commercial banks, used to build the bank-account task's dropdown.

A static list is the right call here: it drives a select field on the
bank-account step, and Ghana's licensed universal banks change rarely (Bank of
Ghana publishes the register). Update this list when the register changes.
"""

GHANA_BANKS: list[str] = [
    "Absa Bank Ghana",
    "Access Bank Ghana",
    "Agricultural Development Bank (ADB)",
    "Bank of Africa Ghana",
    "CalBank",
    "Consolidated Bank Ghana (CBG)",
    "Ecobank Ghana",
    "FBNBank Ghana",
    "Fidelity Bank Ghana",
    "First Atlantic Bank",
    "First National Bank Ghana",
    "GCB Bank",
    "Guaranty Trust Bank (GTBank) Ghana",
    "National Investment Bank (NIB)",
    "OmniBSIC Bank",
    "Prudential Bank",
    "Republic Bank Ghana",
    "Societe Generale Ghana",
    "Stanbic Bank Ghana",
    "Standard Chartered Bank Ghana",
    "United Bank for Africa (UBA) Ghana",
    "Universal Merchant Bank (UMB)",
    "Zenith Bank Ghana",
    "Other",
]


def bank_select_options() -> list[dict]:
    """`[{value, label}]` options for a task input_schema select field."""
    return [{"value": bank, "label": bank} for bank in GHANA_BANKS]

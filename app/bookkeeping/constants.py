# Ghana-relevant expense categories for small businesses.
EXPENSE_CATEGORIES = [
    ("rent", "Rent & premises"),
    ("utilities", "Utilities (ECG, water)"),
    ("salaries", "Salaries & wages"),
    ("inventory", "Inventory & stock"),
    ("transport", "Transport & fuel"),
    ("marketing", "Marketing & advertising"),
    ("professional_fees", "Professional fees"),
    ("bank_charges", "Bank charges"),
    ("equipment", "Equipment & tools"),
    ("telecoms", "Airtime, data & telecoms"),
    ("office_supplies", "Office supplies"),
    ("travel", "Travel & accommodation"),
    ("licences", "Licences & permits"),
    ("taxes", "Taxes & levies"),
    ("other", "Other"),
]

EXPENSE_CATEGORY_CODES = {code for code, _ in EXPENSE_CATEGORIES}

# Common trading currencies in Ghana.
SUPPORTED_CURRENCIES = ["GHS", "USD", "EUR", "GBP", "NGN"]

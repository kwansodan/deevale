def scan_compliance_reminders() -> int:
    from app.compliance.service import scan_obligation_reminders

    return scan_obligation_reminders()

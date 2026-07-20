from app.celery_app import celery_app


@celery_app.task(name="app.compliance.tasks.scan_compliance_reminders")
def scan_compliance_reminders() -> int:
    from app.compliance.service import scan_obligation_reminders

    return scan_obligation_reminders()

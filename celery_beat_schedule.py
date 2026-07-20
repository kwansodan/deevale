from celery.schedules import crontab

from app.celery_app import celery_app

celery_app.conf.beat_schedule = {
    "scan-upcoming-deadlines": {
        "task": "app.deadlines.scanner.scan_upcoming_deadlines",
        "schedule": crontab(hour="*/6"),
    },
    "scan-sla-breaches": {
        "task": "app.deadlines.sla_scanner.scan_sla_breaches",
        "schedule": crontab(minute=0),
    },
    "flush-queued-sms": {
        "task": "app.notifications.tasks.flush_queued_sms",
        "schedule": crontab(minute="*/15"),
    },
    "scan-compliance-reminders": {
        "task": "app.compliance.tasks.scan_compliance_reminders",
        "schedule": crontab(hour=8, minute=0),
    },
    "materialize-report-snapshot": {
        "task": "app.reports.tasks.materialize_report_snapshot",
        "schedule": crontab(hour=2, minute=0),
    },
    "shred-expired-mail": {
        "task": "app.mailroom.tasks.shred_expired_mail",
        "schedule": crontab(hour=3, minute=30),
    },
    "mark-overdue-invoices": {
        "task": "app.bookkeeping.tasks.mark_overdue_invoices",
        "schedule": crontab(hour=6, minute=0),
    },
    "remind-unsigned-parties": {
        "task": "app.signatures.tasks.remind_unsigned_parties",
        "schedule": crontab(hour="*/6"),
    },
    "weekly-digest": {
        # Sunday 18:00 GMT (Ghana local time == GMT).
        "task": "app.notifications.tasks.send_weekly_digests",
        "schedule": crontab(day_of_week="sun", hour=18, minute=0),
    },
}

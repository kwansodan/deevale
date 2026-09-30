import logging
import os
from typing import Any, Callable

import inngest
import inngest.flask

logger = logging.getLogger("deevalegh.inngest")

inngest_base_url = (
    os.environ.get("INNGEST_BASE_URL")
    or os.environ.get("INNGEST_EVENT_API_BASE_URL")
)

if inngest_base_url:
    os.environ.setdefault("INNGEST_BASE_URL", inngest_base_url)
    os.environ.setdefault("INNGEST_EVENT_API_BASE_URL", inngest_base_url)

inngest_client = inngest.Inngest(
    app_id="deevalegh",
    is_production=bool(os.environ.get("FLASK_ENV") == "production" and not inngest_base_url),
    logger=logger,
)


class InngestTask:
    """Wrapper that preserves regular callable semantics and .delay() interface
    while routing background dispatches through Inngest events."""

    def __init__(self, fn: Callable, event_name: str, param_key: str):
        self.fn = fn
        self.event_name = event_name
        self.param_key = param_key
        self.__name__ = getattr(fn, "__name__", "inngest_task")
        self.__doc__ = getattr(fn, "__doc__", None)

    def __call__(self, *args, **kwargs) -> Any:
        return self.fn(*args, **kwargs)

    def delay(self, arg: Any) -> Any:
        from flask import current_app

        # Eager execution for test environments or when Inngest signing key is not set
        is_testing = False
        try:
            is_testing = bool(current_app.config.get("TESTING"))
        except RuntimeError:
            pass

        has_inngest_credentials = bool(
            os.environ.get("INNGEST_EVENT_KEY")
            or os.environ.get("INNGEST_SIGNING_KEY")
            or os.environ.get("INNGEST_DEV")
            or os.environ.get("INNGEST_BASE_URL")
        )

        if is_testing or not has_inngest_credentials:
            return self.fn(arg)

        try:
            inngest_client.send_sync(
                inngest.Event(
                    name=self.event_name,
                    data={self.param_key: arg},
                )
            )
        except Exception as exc:
            logger.warning(
                "Inngest dispatch failed for %s, falling back to synchronous run: %s",
                self.event_name,
                exc,
            )
            return self.fn(arg)


def task_wrapper(event_name: str, param_key: str):
    """Decorator to convert a standard task function into an InngestTask."""

    def decorator(fn: Callable) -> InngestTask:
        return InngestTask(fn, event_name, param_key)

    return decorator


# --- Inngest Event Function Registrations ---


@inngest_client.create_function(
    fn_id="send-notification-delivery",
    trigger=inngest.TriggerEvent(event="notification/delivery.send"),
)
def inngest_send_notification_delivery(ctx: inngest.ContextSync):
    from app.notifications.tasks import send_notification_delivery

    delivery_id = ctx.event.data.get("delivery_id")
    return send_notification_delivery(delivery_id)


@inngest_client.create_function(
    fn_id="generate-invoice-pdf",
    trigger=inngest.TriggerEvent(event="bookkeeping/invoice.generate"),
)
def inngest_generate_invoice_pdf(ctx: inngest.ContextSync):
    from app.bookkeeping.tasks import generate_invoice_pdf

    invoice_id = ctx.event.data.get("invoice_id")
    return generate_invoice_pdf(invoice_id)


@inngest_client.create_function(
    fn_id="generate-receipt-pdf",
    trigger=inngest.TriggerEvent(event="payment/receipt.generate"),
)
def inngest_generate_receipt_pdf(ctx: inngest.ContextSync):
    from app.payments.tasks import generate_receipt_pdf

    invoice_id = ctx.event.data.get("invoice_id")
    return generate_receipt_pdf(invoice_id)


@inngest_client.create_function(
    fn_id="assemble-signed-pdf",
    trigger=inngest.TriggerEvent(event="signature/pdf.assemble"),
)
def inngest_assemble_signed_pdf(ctx: inngest.ContextSync):
    from app.signatures.tasks import assemble_signed_pdf

    request_id = ctx.event.data.get("request_id")
    return assemble_signed_pdf(request_id)


@inngest_client.create_function(
    fn_id="scan-document-version",
    trigger=inngest.TriggerEvent(event="document/version.scan"),
)
def inngest_scan_document_version(ctx: inngest.ContextSync):
    from app.documents.tasks import scan_document_version

    document_version_id = ctx.event.data.get("document_version_id")
    return scan_document_version(document_version_id)


@inngest_client.create_function(
    fn_id="deliver-webhook",
    trigger=inngest.TriggerEvent(event="partner/webhook.deliver"),
)
def inngest_deliver_webhook(ctx: inngest.ContextSync):
    from app.partners.tasks import deliver_webhook

    delivery_id = ctx.event.data.get("delivery_id")
    return deliver_webhook(delivery_id)


# --- Inngest Scheduled Cron Registrations (Replacing Celery Beat) ---


@inngest_client.create_function(
    fn_id="check-uptime",
    trigger=inngest.TriggerCron(cron="*/5 * * * *"),
)
def inngest_check_uptime(ctx: inngest.ContextSync):
    from app.monitoring.tasks import check_uptime

    return check_uptime()


@inngest_client.create_function(
    fn_id="flush-queued-sms",
    trigger=inngest.TriggerCron(cron="*/15 * * * *"),
)
def inngest_flush_queued_sms(ctx: inngest.ContextSync):
    from app.notifications.tasks import flush_queued_sms

    return flush_queued_sms()


@inngest_client.create_function(
    fn_id="scan-sla-breaches",
    trigger=inngest.TriggerCron(cron="0 * * * *"),
)
def inngest_scan_sla_breaches(ctx: inngest.ContextSync):
    from app.deadlines.sla_scanner import scan_sla_breaches

    return scan_sla_breaches()


@inngest_client.create_function(
    fn_id="scan-upcoming-deadlines",
    trigger=inngest.TriggerCron(cron="0 */6 * * *"),
)
def inngest_scan_upcoming_deadlines(ctx: inngest.ContextSync):
    from app.deadlines.scanner import scan_upcoming_deadlines

    return scan_upcoming_deadlines()


@inngest_client.create_function(
    fn_id="remind-unsigned-parties",
    trigger=inngest.TriggerCron(cron="0 */6 * * *"),
)
def inngest_remind_unsigned_parties(ctx: inngest.ContextSync):
    from app.signatures.tasks import remind_unsigned_parties

    return remind_unsigned_parties()


@inngest_client.create_function(
    fn_id="materialize-report-snapshot",
    trigger=inngest.TriggerCron(cron="0 2 * * *"),
)
def inngest_materialize_report_snapshot(ctx: inngest.ContextSync):
    from app.reports.tasks import materialize_report_snapshot

    return materialize_report_snapshot()


@inngest_client.create_function(
    fn_id="shred-expired-mail",
    trigger=inngest.TriggerCron(cron="30 3 * * *"),
)
def inngest_shred_expired_mail(ctx: inngest.ContextSync):
    from app.mailroom.tasks import shred_expired_mail

    return shred_expired_mail()


@inngest_client.create_function(
    fn_id="mark-overdue-invoices",
    trigger=inngest.TriggerCron(cron="0 6 * * *"),
)
def inngest_mark_overdue_invoices(ctx: inngest.ContextSync):
    from app.bookkeeping.tasks import mark_overdue_invoices

    return mark_overdue_invoices()


@inngest_client.create_function(
    fn_id="scan-compliance-reminders",
    trigger=inngest.TriggerCron(cron="0 8 * * *"),
)
def inngest_scan_compliance_reminders(ctx: inngest.ContextSync):
    from app.compliance.tasks import scan_compliance_reminders

    return scan_compliance_reminders()


@inngest_client.create_function(
    fn_id="weekly-digest",
    trigger=inngest.TriggerCron(cron="0 18 * * 0"),
)
def inngest_weekly_digest(ctx: inngest.ContextSync):
    from app.notifications.tasks import send_weekly_digests

    return send_weekly_digests()


inngest_functions = [
    inngest_send_notification_delivery,
    inngest_generate_invoice_pdf,
    inngest_generate_receipt_pdf,
    inngest_assemble_signed_pdf,
    inngest_scan_document_version,
    inngest_deliver_webhook,
    inngest_check_uptime,
    inngest_flush_queued_sms,
    inngest_scan_sla_breaches,
    inngest_scan_upcoming_deadlines,
    inngest_remind_unsigned_parties,
    inngest_materialize_report_snapshot,
    inngest_shred_expired_mail,
    inngest_mark_overdue_invoices,
    inngest_scan_compliance_reminders,
    inngest_weekly_digest,
]


def register_inngest(app):
    """Mounts Inngest serve handler on the Flask app at /api/inngest."""
    try:
        inngest.flask.serve(app, inngest_client, inngest_functions)
    except Exception as exc:
        logger.warning("Inngest serve handler registration skipped or failed: %s", exc)

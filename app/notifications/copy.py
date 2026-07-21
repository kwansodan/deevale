"""Client- and staff-facing notification copy, one entry per
NotificationCategory. Kept as simple format strings (not full Jinja2) for the
short in-app title/body; the same rendered text is reused inside the shared
email template (app/templates/notifications/email/base.{html,txt}.j2) so the
wording lives in exactly one place.
"""


class _DefaultDict(dict):
    def __missing__(self, key):
        return ""


NOTIFICATION_COPY = {
    "stage_completed": {
        "title": "Stage complete: {stage_name}",
        "body": "\U0001f389 Great news: '{stage_name}' is done for {business_name}. {next_step}",
    },
    "action_required": {
        "title": "Action needed: {task_name}",
        "body": "We need something from you on {business_name}: {task_name}.",
    },
    "document_rejected": {
        "title": "Document needs another look",
        "body": "Your {document_type} for {business_name} wasn't approved ({reason}). {note}",
    },
    "payment_due": {
        "title": "Payment due for {business_name}",
        "body": "Your invoice {invoice_number} (GHS {amount}) is ready. Pay to keep {business_name} moving.",
    },
    "payment_received": {
        "title": "Payment received",
        "body": "Thanks! We've received your payment for {business_name}. Your registration is moving forward.",
    },
    "gov_processing_update": {
        "title": "Update on {business_name}",
        "body": "{update_text}",
    },
    "deadline_countdown": {
        "title": "{days_remaining} days left",
        "body": "⏰ Your {entity_label} for {business_name} needs attention in {days_remaining} days.",
    },
    "case_blocked": {
        "title": "Action needed: {business_name} is on hold",
        "body": "Your case is currently blocked: {reason}.",
    },
    "staff_new_upload": {
        "title": "New client upload",
        "body": "{client_name} uploaded a new document on case {case_number}.",
    },
    "staff_sla_breach": {
        "title": "SLA breach on {case_number}",
        "body": "Case {case_number}: '{task_name}' has breached its SLA.",
    },
    "staff_payment_received": {
        "title": "Payment received",
        "body": "Payment received for case {case_number} ({business_name}).",
    },
}


# Twi (Akan) copy for the top client-facing notification categories.
# MACHINE-DRAFT — every string is a machine-generated draft and must be
# reviewed by a fluent Twi speaker before release. Categories missing here fall
# back to the English copy above at runtime.
NOTIFICATION_COPY_TW = {
    "stage_completed": {
        "title": "Nkyekyɛmu awie: {stage_name}",
        "body": "\U0001f389 Asɛmpa — '{stage_name}' awie ama {business_name}. {next_step}",
    },
    "action_required": {
        "title": "Deɛ ɛsɛ sɛ woyɛ: {task_name}",
        "body": "Yɛhia biribi firi wo hɔ wɔ {business_name} ho: {task_name}.",
    },
    "document_rejected": {
        "title": "Krataa no hia nhwɛ foforɔ",
        "body": "Wɔannye wo {document_type} a ɛwɔ {business_name} ho no ({reason}). {note}",
    },
    "payment_due": {
        "title": "Ka a ɛsɛ sɛ wotua ma {business_name}",
        "body": "Wo krataa {invoice_number} (GHS {amount}) asiesie. Tua na {business_name} nkɔ so.",
    },
    "payment_received": {
        "title": "Yɛanya sika no",
        "body": "Meda wo ase! Yɛanya wo tuo ama {business_name}. Wo nkyerɛwee rekɔ so.",
    },
    "gov_processing_update": {
        "title": "Nsɛm foforɔ fa {business_name} ho",
        "body": "{update_text}",
    },
    "deadline_countdown": {
        "title": "Nna {days_remaining} aka",
        "body": "⏰ Wo {entity_label} a ɛwɔ {business_name} ho hia adwuma wɔ nna {days_remaining} mu.",
    },
    "case_blocked": {
        "title": "Hwɛ: {business_name} agyina",
        "body": "Wo asɛm agyina seesei: {reason}.",
    },
}

_LOCALE_COPY = {"tw": NOTIFICATION_COPY_TW}


def render_notification(category: str, context: dict, locale: str = "en") -> tuple[str, str]:
    from app.notifications.models import NotificationTemplate

    override = NotificationTemplate.query.filter_by(category=category).first()
    if override is not None:
        templates = {"title": override.title_template, "body": override.body_template}
    else:
        localized = _LOCALE_COPY.get(locale, {})
        templates = localized.get(category) or NOTIFICATION_COPY[category]

    safe_context = _DefaultDict(context)
    title = templates["title"].format_map(safe_context)
    body = templates["body"].format_map(safe_context)
    return title, body

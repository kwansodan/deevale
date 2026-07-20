import logging
from abc import ABC, abstractmethod

from flask import current_app

from app.notifications.channels.base import ChannelAdapter

logger = logging.getLogger("deevalegh.whatsapp")

# Maps each notification category to its pre-approved WhatsApp Business
# template plus the ordered context variables the template expects. WhatsApp
# rejects free-form business-initiated messages, so every category MUST have
# an approved template before enabling the channel for it.
WHATSAPP_TEMPLATE_MAP: dict[str, tuple[str, list[str]]] = {
    "stage_completed": ("lgh_stage_completed", ["business_name", "stage_name"]),
    "action_required": ("lgh_action_required", ["business_name", "task_name"]),
    "document_rejected": ("lgh_document_rejected", ["document_type", "reason"]),
    "payment_due": ("lgh_payment_due", ["business_name", "invoice_number", "amount"]),
    "payment_received": ("lgh_payment_received", ["business_name"]),
    "deadline_countdown": ("lgh_deadline", ["business_name", "days_remaining"]),
    "case_blocked": ("lgh_case_blocked", ["business_name", "reason"]),
}


class WhatsAppSender(ABC):
    @abstractmethod
    def send_template(self, to_phone: str, template_name: str, variables: list[str]) -> int:
        """Sends a template message; returns cost in pesewas."""


class ConsoleWhatsAppSender(WhatsAppSender):
    def send_template(self, to_phone: str, template_name: str, variables: list[str]) -> int:
        logger.info("[DEV WHATSAPP] To %s | template=%s | vars=%s", to_phone, template_name, variables)
        return 0


class MetaWhatsAppSender(WhatsAppSender):
    """WhatsApp Business Cloud API."""

    def send_template(self, to_phone: str, template_name: str, variables: list[str]) -> int:
        import requests

        phone_number_id = current_app.config["WHATSAPP_PHONE_NUMBER_ID"]
        response = requests.post(
            f"https://graph.facebook.com/v20.0/{phone_number_id}/messages",
            headers={"Authorization": f"Bearer {current_app.config['WHATSAPP_ACCESS_TOKEN']}"},
            json={
                "messaging_product": "whatsapp",
                "to": to_phone.lstrip("+"),
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": "en"},
                    "components": [
                        {
                            "type": "body",
                            "parameters": [{"type": "text", "text": str(v)} for v in variables],
                        }
                    ],
                },
            },
            timeout=15,
        )
        response.raise_for_status()
        return 0


def get_whatsapp_sender() -> WhatsAppSender:
    backend = current_app.config.get("WHATSAPP_SENDER", "console")
    if backend == "meta":
        return MetaWhatsAppSender()
    return ConsoleWhatsAppSender()


def render_whatsapp_variables(category: str, context: dict) -> tuple[str, list[str]] | None:
    """Resolves the template name and its ordered variable values for a
    category, or None when no approved template exists (channel skipped)."""
    mapping = WHATSAPP_TEMPLATE_MAP.get(category)
    if mapping is None:
        return None
    template_name, variable_keys = mapping
    return template_name, [str(context.get(key, "")) for key in variable_keys]


class WhatsAppChannel(ChannelAdapter):
    def deliver(self, user, notification, delivery, context: dict) -> None:
        rendered = render_whatsapp_variables(notification.category, context)
        if rendered is None:
            delivery.status = "abandoned"
            delivery.last_error = "No approved WhatsApp template for this category"
            return
        template_name, variables = rendered
        delivery.payload = {"template_name": template_name, "variables": variables}

        from app.notifications.tasks import send_notification_delivery

        send_notification_delivery.delay(str(delivery.id))

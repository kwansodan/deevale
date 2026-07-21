import logging
from abc import ABC, abstractmethod

from flask import current_app

from app.notifications.channels.base import ChannelAdapter

logger = logging.getLogger("deevalegh.email")


class EmailSender(ABC):
    @abstractmethod
    def send(self, to_email: str, subject: str, html_body: str, text_body: str) -> None: ...


class ConsoleEmailSender(EmailSender):
    def send(self, to_email: str, subject: str, html_body: str, text_body: str) -> None:
        logger.info("[DEV EMAIL] To: %s | Subject: %s\n%s", to_email, subject, text_body)


class ResendEmailSender(EmailSender):
    """Resend backend for production. Kept behind the same EmailSender
    interface as ConsoleEmailSender so swapping backends is just an
    EMAIL_SENDER config change."""

    def send(self, to_email: str, subject: str, html_body: str, text_body: str) -> None:
        import requests

        response = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {current_app.config['RESEND_API_KEY']}"},
            json={
                "from": current_app.config["EMAIL_FROM_ADDRESS"],
                "to": [to_email],
                "subject": subject,
                "html": html_body,
                "text": text_body,
            },
            timeout=15,
        )
        response.raise_for_status()


def get_email_sender() -> EmailSender:
    backend = current_app.config.get("EMAIL_SENDER", "console")
    if backend == "resend":
        return ResendEmailSender()
    return ConsoleEmailSender()


class EmailChannel(ChannelAdapter):
    def deliver(self, user, notification, delivery, context: dict) -> None:
        from app.notifications.tasks import send_notification_delivery

        send_notification_delivery.delay(str(delivery.id))

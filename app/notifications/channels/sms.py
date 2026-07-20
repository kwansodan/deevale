import logging
from abc import ABC, abstractmethod
from datetime import timedelta

from flask import current_app

from app.core.model_mixins import utcnow
from app.notifications.channels.base import ChannelAdapter
from app.notifications.enums import DeliveryStatus

logger = logging.getLogger("launchgh.sms")


class SmsSender(ABC):
    @abstractmethod
    def send(self, to_phone: str, body: str) -> int:
        """Sends an SMS; returns the per-message cost in pesewas."""


class ConsoleSmsSender(SmsSender):
    def send(self, to_phone: str, body: str) -> int:
        sender_id = current_app.config["SMS_SENDER_ID"]
        logger.info("[DEV SMS] From %s to %s: %s", sender_id, to_phone, body)
        return current_app.config["SMS_DEFAULT_COST_MINOR"]


class TwilioSmsSender(SmsSender):
    def send(self, to_phone: str, body: str) -> int:
        from twilio.rest import Client  # optional dependency, prod only

        client = Client(current_app.config["TWILIO_ACCOUNT_SID"], current_app.config["TWILIO_AUTH_TOKEN"])
        message = client.messages.create(
            to=to_phone, from_=current_app.config["SMS_SENDER_ID"], body=body
        )
        # Twilio reports price in major units (often after delivery); fall
        # back to the configured flat cost when not yet available.
        if message.price:
            return abs(int(float(message.price) * 100))
        return current_app.config["SMS_DEFAULT_COST_MINOR"]


class HubtelSmsSender(SmsSender):
    def send(self, to_phone: str, body: str) -> int:
        import requests

        response = requests.post(
            "https://smsc.hubtel.com/v1/messages/send",
            params={
                "clientid": current_app.config["HUBTEL_CLIENT_ID"],
                "clientsecret": current_app.config["HUBTEL_CLIENT_SECRET"],
                "from": current_app.config["SMS_SENDER_ID"],
                "to": to_phone,
                "content": body,
            },
            timeout=15,
        )
        response.raise_for_status()
        return current_app.config["SMS_DEFAULT_COST_MINOR"]


def get_sms_sender() -> SmsSender:
    backend = current_app.config.get("SMS_SENDER", "console")
    if backend == "twilio":
        return TwilioSmsSender()
    if backend == "hubtel":
        return HubtelSmsSender()
    return ConsoleSmsSender()


def in_quiet_hours(now=None) -> bool:
    """Ghana quiet hours: no SMS 21:00-07:00. Africa/Accra is UTC year-round,
    so UTC hour comparison is exact."""
    now = now or utcnow()
    start = current_app.config["SMS_QUIET_HOURS_START"]
    end = current_app.config["SMS_QUIET_HOURS_END"]
    return now.hour >= start or now.hour < end


def next_quiet_hours_end(now=None):
    now = now or utcnow()
    end = current_app.config["SMS_QUIET_HOURS_END"]
    candidate = now.replace(hour=end, minute=0, second=0, microsecond=0)
    if now.hour >= end:
        candidate += timedelta(days=1)
    return candidate


class SmsChannel(ChannelAdapter):
    def deliver(self, user, notification, delivery, context: dict) -> None:
        if in_quiet_hours():
            delivery.status = DeliveryStatus.QUEUED.value
            delivery.next_retry_at = next_quiet_hours_end()
            return

        from app.notifications.tasks import send_notification_delivery

        send_notification_delivery.delay(str(delivery.id))

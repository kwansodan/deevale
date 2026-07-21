import logging
import secrets
from abc import ABC, abstractmethod

logger = logging.getLogger("deevalegh.otp")


class OtpSender(ABC):
    @abstractmethod
    def send_sms(self, phone: str, code: str) -> None: ...

    @abstractmethod
    def send_email(self, email: str, code: str) -> None: ...


class ConsoleOtpSender(OtpSender):
    """Dev-mode sender: logs the OTP to the console instead of dispatching
    a real SMS/email. Swap for a TwilioSmsSender (or similar) in production
    by changing OTP_SENDER config -- nothing else in the auth flow changes.
    """

    def send_sms(self, phone: str, code: str) -> None:
        logger.info("[DEV OTP] SMS to %s: your Deevale GH code is %s", phone, code)

    def send_email(self, email: str, code: str) -> None:
        logger.info("[DEV OTP] Email to %s: your Deevale GH code is %s", email, code)


class LiveOtpSender(OtpSender):
    """Dispatches OTPs through the configured notification providers.

    Deliberately delegates rather than talking to Resend/Hubtel directly, so
    there is exactly one place per channel that knows about a provider and OTP
    delivery follows EMAIL_SENDER / SMS_SENDER like everything else.
    """

    def send_sms(self, phone: str, code: str) -> None:
        from app.notifications.channels.sms import get_sms_sender

        get_sms_sender().send(phone, f"Your Deevale GH verification code is {code}.")

    def send_email(self, email: str, code: str) -> None:
        from app.notifications.channels.email import get_email_sender

        subject = "Your Deevale GH verification code"
        text = (
            f"Your Deevale GH verification code is {code}.\n\n"
            "It expires shortly. If you did not request it, ignore this email."
        )
        html = (
            f"<p>Your Deevale GH verification code is <strong>{code}</strong>.</p>"
            "<p>It expires shortly. If you did not request it, ignore this email.</p>"
        )
        get_email_sender().send(email, subject, html, text)


def get_otp_sender() -> OtpSender:
    """console (default) logs the code; live sends via the real providers."""
    from flask import current_app

    if current_app.config.get("OTP_SENDER", "console") == "live":
        return LiveOtpSender()
    return ConsoleOtpSender()


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"

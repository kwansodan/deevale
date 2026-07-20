import logging
import secrets
from abc import ABC, abstractmethod

logger = logging.getLogger("launchgh.otp")


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
        logger.info("[DEV OTP] SMS to %s: your LaunchGH code is %s", phone, code)

    def send_email(self, email: str, code: str) -> None:
        logger.info("[DEV OTP] Email to %s: your LaunchGH code is %s", email, code)


def get_otp_sender() -> OtpSender:
    return ConsoleOtpSender()


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"

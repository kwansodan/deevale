from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class InitResult:
    authorization_url: str
    provider_reference: str


@dataclass
class VerifyResult:
    status: str  # "success" | "failed"
    amount_minor: int
    channel: str
    provider_reference: str


@dataclass
class WebhookEvent:
    provider_reference: str
    status: str  # "success" | "failed"
    amount_minor: int
    channel: str
    raw: dict = field(default_factory=dict)


class PaymentProvider(ABC):
    """Abstraction over a payment gateway so Flutterwave/Hubtel/etc. can be
    added later without touching invoice_service.py or the payments routes.
    """

    @abstractmethod
    def initialize_transaction(self, *, invoice, customer_email: str, callback_url: str) -> InitResult: ...

    @abstractmethod
    def verify_transaction(self, provider_reference: str) -> VerifyResult: ...

    @abstractmethod
    def parse_webhook(self, raw_body: bytes, signature_header: str) -> WebhookEvent: ...

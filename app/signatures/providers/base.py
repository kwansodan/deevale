from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class WebhookResult:
    provider_reference: str
    event: str  # "completed" | "declined" | "signed"
    party_email: str | None = None


class SignatureProvider(ABC):
    """Abstraction over an e-signature backend so an external provider
    (Dropbox Sign / DocuSign) or the built-in canvas fallback can be swapped
    without touching signing business logic."""

    name: str

    @abstractmethod
    def send(self, request) -> str:
        """Dispatches the signing request to signers. Returns a provider
        reference. For the built-in provider this is a no-op that just returns
        a local reference -- signing happens through our own endpoints."""

    @abstractmethod
    def parse_webhook(self, raw_body: bytes, headers: dict) -> WebhookResult:
        """Verifies + normalizes a provider webhook. The built-in provider has
        no external webhook (completion is detected inline)."""

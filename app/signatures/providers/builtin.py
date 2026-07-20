import uuid

from app.signatures.providers.base import SignatureProvider, WebhookResult


class BuiltinSignatureProvider(SignatureProvider):
    """Fallback provider: signatures are captured on a canvas (drawn) or typed
    on our own signing pages, embedded into the generated PDF with a timestamp
    and the signer's IP, and flagged as a 'simple electronic signature'.
    There is no external service, so send() is a local no-op and there is no
    inbound webhook."""

    name = "builtin"

    def send(self, request) -> str:
        return f"builtin-{uuid.uuid4()}"

    def parse_webhook(self, raw_body: bytes, headers: dict) -> WebhookResult:
        raise NotImplementedError("The built-in signature provider has no webhook.")

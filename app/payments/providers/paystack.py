import hashlib
import hmac
import json
import uuid

import requests
from flask import current_app

from app.core.errors import AppError
from app.payments.provider_base import InitResult, PaymentProvider, VerifyResult, WebhookEvent


class InvalidWebhookSignatureError(AppError):
    status_code = 400
    error_code = "invalid_webhook_signature"

    def __init__(self):
        super().__init__("Invalid Paystack webhook signature")


class PaymentProviderError(AppError):
    """Paystack rejected the request. Carries Paystack's own message so the client
    sees something actionable instead of a bare 500."""

    status_code = 502
    error_code = "payment_provider_error"


def _paystack_message(response: requests.Response) -> str:
    """Best-effort extraction of Paystack's error message from a failed response."""
    try:
        return str(response.json().get("message") or response.text)[:300]
    except ValueError:
        return response.text[:300]


class PaystackProvider(PaymentProvider):
    def _secret_key(self) -> str:
        return current_app.config["PAYSTACK_SECRET_KEY"]

    def _base_url(self) -> str:
        return current_app.config["PAYSTACK_BASE_URL"]

    def initialize_transaction(self, *, invoice, customer_email: str, callback_url: str) -> InitResult:
        # Reference MUST be unique per attempt. A deterministic reference
        # ({invoice_number}-{invoice.id}) collides with itself on any retry and
        # Paystack rejects it with 400 "Duplicate Transaction Reference". The
        # webhook resolves the invoice via the Payment row we store below, not by
        # parsing this string, so a random suffix is safe.
        reference = f"{invoice.invoice_number}-{uuid.uuid4().hex[:12]}"
        response = requests.post(
            f"{self._base_url()}/transaction/initialize",
            headers={"Authorization": f"Bearer {self._secret_key()}"},
            json={
                "email": customer_email,
                "amount": invoice.total_minor,
                "currency": invoice.currency,
                "reference": reference,
                "callback_url": callback_url,
                "channels": ["card", "mobile_money"],
            },
            timeout=15,
        )
        if response.status_code >= 400:
            detail = _paystack_message(response)
            current_app.logger.error(
                "Paystack initialize failed for invoice %s (%s): %s",
                invoice.invoice_number,
                response.status_code,
                detail,
            )
            raise PaymentProviderError(f"Couldn't start the payment. Paystack said: {detail}")
        data = response.json()["data"]
        return InitResult(authorization_url=data["authorization_url"], provider_reference=data["reference"])

    def verify_transaction(self, provider_reference: str) -> VerifyResult:
        response = requests.get(
            f"{self._base_url()}/transaction/verify/{provider_reference}",
            headers={"Authorization": f"Bearer {self._secret_key()}"},
            timeout=15,
        )
        if response.status_code >= 400:
            detail = _paystack_message(response)
            current_app.logger.error(
                "Paystack verify failed for %s (%s): %s", provider_reference, response.status_code, detail
            )
            raise PaymentProviderError(f"Couldn't verify the payment. Paystack said: {detail}")
        data = response.json()["data"]
        return VerifyResult(
            status="success" if data["status"] == "success" else "failed",
            amount_minor=data["amount"],
            channel=data.get("channel", "card"),
            provider_reference=data["reference"],
        )

    def parse_webhook(self, raw_body: bytes, signature_header: str) -> WebhookEvent:
        expected = hmac.new(self._secret_key().encode("utf-8"), raw_body, hashlib.sha512).hexdigest()
        if not signature_header or not hmac.compare_digest(expected, signature_header):
            raise InvalidWebhookSignatureError()

        payload = json.loads(raw_body)
        data = payload.get("data", {})
        is_success = payload.get("event") == "charge.success" and data.get("status") == "success"
        return WebhookEvent(
            provider_reference=data.get("reference", ""),
            status="success" if is_success else "failed",
            amount_minor=data.get("amount", 0),
            channel=data.get("channel", "card"),
            raw=payload,
        )

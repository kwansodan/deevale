import hashlib
import hmac
import json

import pytest


def sign_paystack_payload(payload: dict, secret: str) -> tuple[bytes, str]:
    raw_body = json.dumps(payload).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha512).hexdigest()
    return raw_body, signature


@pytest.fixture(autouse=True)
def fake_paystack_init(monkeypatch):
    """No live Paystack keys in tests -- stub the checkout initialization
    call so invoice/initialize-transaction can be exercised purely against
    the DB. Webhook signature verification is exercised for real (it's pure
    HMAC math, no network needed) using PAYSTACK_SECRET_KEY from TestConfig.
    """
    from app.payments.provider_base import InitResult

    def fake_initialize(self, *, invoice, customer_email, callback_url):
        return InitResult(
            authorization_url=f"https://paystack.test/checkout/{invoice.invoice_number}",
            provider_reference=f"ref-{invoice.invoice_number}",
        )

    monkeypatch.setattr("app.payments.providers.paystack.PaystackProvider.initialize_transaction", fake_initialize)


@pytest.fixture(autouse=True)
def fake_receipt_pdf(monkeypatch):
    """WeasyPrint needs native libs not available in the test environment --
    stub the receipt generation task so payment.received handling can be
    tested without it."""
    from unittest.mock import MagicMock

    monkeypatch.setattr("app.payments.tasks.generate_receipt_pdf.delay", MagicMock())

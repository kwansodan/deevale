from flask import current_app

from app.payments.provider_base import PaymentProvider
from app.payments.providers.paystack import PaystackProvider

_PROVIDERS = {
    "paystack": PaystackProvider,
}


def get_payment_provider() -> PaymentProvider:
    name = current_app.config.get("PAYMENT_PROVIDER", "paystack")
    provider_cls = _PROVIDERS.get(name)
    if provider_cls is None:
        raise ValueError(f"Unknown payment provider '{name}'")
    return provider_cls()

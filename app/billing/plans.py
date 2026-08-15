"""Paystack Plan management for recurring compliance subscriptions.

A Paystack Plan is what makes billing recurring -- once a customer checks out
against a plan, Paystack auto-charges their card every interval. We create the
plans on demand and cache their codes so there is no manual dashboard setup; an
env override (SUBSCRIPTION_*_PLAN_CODE) wins when provided.
"""

import requests
from flask import current_app

from app.admin import settings_service
from app.extensions import db
from app.payments.providers.paystack import PaymentProviderError, _paystack_message

PLANS_KEY = "paystack_plans"
_INTERVAL = {"monthly": "monthly", "annual": "annually"}


def get_plan_code(plan_key: str) -> str:
    """Return a Paystack Plan code for `monthly`/`annual`, creating and caching
    one if needed."""
    env = current_app.config[
        "SUBSCRIPTION_MONTHLY_PLAN_CODE" if plan_key == "monthly" else "SUBSCRIPTION_ANNUAL_PLAN_CODE"
    ]
    if env:
        return env

    cached = settings_service.get_json(PLANS_KEY) or {}
    if cached.get(plan_key):
        return cached[plan_key]

    amount = current_app.config[
        "SUBSCRIPTION_MONTHLY_PRICE_MINOR" if plan_key == "monthly" else "SUBSCRIPTION_ANNUAL_PRICE_MINOR"
    ]
    resp = requests.post(
        f"{current_app.config['PAYSTACK_BASE_URL']}/plan",
        headers={"Authorization": f"Bearer {current_app.config['PAYSTACK_SECRET_KEY']}"},
        json={
            "name": f"Deevale GH compliance ({plan_key})",
            "interval": _INTERVAL[plan_key],
            "amount": amount,
            "currency": "GHS",
        },
        timeout=15,
    )
    if resp.status_code >= 400:
        raise PaymentProviderError(
            f"Couldn't set up the subscription plan. Paystack said: {_paystack_message(resp)}"
        )
    code = resp.json()["data"]["plan_code"]
    cached[plan_key] = code
    settings_service.set_json(PLANS_KEY, cached)
    db.session.commit()
    return code

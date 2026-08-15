"""Exchange rates for the public landing page's currency display.

Indicative only -- real invoices and Paystack charges stay in GHS. Rates come
from a free, no-key provider (open.er-api.com), are cached in platform_settings,
and refresh lazily once past the TTL. A provider outage falls back to the last
good cache so the site never breaks.
"""

import time

import requests
from flask import current_app

from app.admin import settings_service
from app.extensions import db

RATES_KEY = "exchange_rates"


def _fetch_from_provider() -> dict:
    resp = requests.get(current_app.config["EXCHANGE_RATES_URL"], timeout=10)
    resp.raise_for_status()
    data = resp.json()
    # open.er-api.com -> {"base_code": "USD", "rates": {...}}
    rates = data.get("rates") or data.get("conversion_rates")
    if not isinstance(rates, dict) or "USD" not in rates or "GHS" not in rates:
        raise ValueError("Unexpected exchange-rate response shape")
    # Keep only what we need + a few common bases an admin might price in.
    keep = ("USD", "GHS", "EUR", "GBP", "NGN", "ZAR", "CAD", "AUD")
    trimmed = {k: float(rates[k]) for k in keep if k in rates}
    return {"base": "USD", "rates": trimmed, "fetched_at": int(time.time())}


def get_rates() -> dict:
    """USD-based rate table, cached with a TTL. On a fetch failure returns the
    last good cache (stale) if any, else a minimal USD-only table so conversion
    degrades gracefully (prices then just show in their base currency)."""
    ttl = current_app.config["EXCHANGE_RATES_TTL_SECONDS"]
    cached = settings_service.get_json(RATES_KEY)
    now = int(time.time())
    if cached and now - int(cached.get("fetched_at", 0)) < ttl:
        return cached
    try:
        fresh = _fetch_from_provider()
        settings_service.set_json(RATES_KEY, fresh)
        db.session.commit()
        return fresh
    except Exception:
        current_app.logger.exception("Exchange-rate fetch failed")
        db.session.rollback()
        if cached:
            return cached
        return {"base": "USD", "rates": {"USD": 1.0}, "fetched_at": now}

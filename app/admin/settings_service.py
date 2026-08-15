"""Read/write helpers for runtime platform settings.

Every getter falls back to app.config (which itself reads env) so an empty
`platform_settings` table behaves exactly like today's env-only configuration.
Admin writes become the override.
"""

from flask import current_app

from app.admin.models import PlatformSetting
from app.extensions import db

REFERRAL_KEY = "referral"
LANDING_KEY = "landing"

# The public landing figures an admin can set. Grouped to mirror the frontend's
# consumption in frontend/src/config/landing.ts. Every field is optional; an
# unset field stays null and the page degrades visibly ("Request a quote").
LANDING_DEFAULT: dict = {
    "company": {
        "legalName": None,
        "registrationNumber": None,
        "address": None,
        "email": None,
        "phone": None,
        "whatsapp": None,
        "yearsOperating": None,
        "casesCompleted": None,
        "dataProtectionNumber": None,
    },
    # Base currency the admin enters prices in. The landing page shows them in
    # GHS (Ghana visitors) or USD (everyone else), converted from this base.
    "pricing": {
        "base_currency": "GHS",
    },
    # Prices are now numeric amounts in `pricing.base_currency` (major units),
    # not free-text, so they can be converted for display.
    "prices": {
        "ltd_shares": None,
        "sole_proprietorship": None,
        "partnership": None,
        "ltd_guarantee": None,
        "external_company": None,
        "foreign_ltd_shares": None,
    },
    "timelines": {
        "ltd_shares": None,
        "sole_proprietorship": None,
        "partnership": None,
        "ltd_guarantee": None,
        "external_company": None,
        "foreign_ltd_shares": None,
    },
    "gipc": {
        "jointVenture": None,
        "whollyForeign": None,
        "trading": None,
        "registrationFee": None,
    },
    "compliance": {
        "monthlyPrice": None,
        "annualPrice": None,
        "registeredAddressPrice": None,
    },
    "legal": {
        "termsUrl": None,
        "privacyUrl": None,
        "refundUrl": None,
    },
    # Real social proof, admin-managed. Lists stay empty until populated; the
    # public page hides each section when its list is empty / the rating unset,
    # so nothing is ever fabricated (same honesty rule as the figures above).
    "testimonials": [],  # [{quote, name, role, company, avatarUrl, rating}]
    "logos": [],  # [{name, imageUrl, url}] -- imageUrl optional, falls back to name
    "rating": {
        "score": None,  # e.g. "4.9"
        "count": None,  # e.g. "120"
        "source": None,  # e.g. "Google"
    },
}


def get_json(key: str, default=None):
    setting = PlatformSetting.query.filter_by(key=key).first()
    return setting.value if setting is not None else default


def set_json(key: str, value: dict, user_id=None) -> PlatformSetting:
    setting = PlatformSetting.query.filter_by(key=key).first()
    if setting is None:
        setting = PlatformSetting(key=key)
        db.session.add(setting)
    setting.value = value
    setting.updated_by_id = user_id
    return setting


# --- Typed accessors ---------------------------------------------------------


def referral_reward_minor() -> int:
    stored = (get_json(REFERRAL_KEY) or {}).get("reward_minor")
    return int(stored) if stored is not None else current_app.config["REFERRAL_REWARD_MINOR"]


def referral_welcome_minor() -> int:
    stored = (get_json(REFERRAL_KEY) or {}).get("welcome_minor")
    return int(stored) if stored is not None else current_app.config["REFERRAL_WELCOME_MINOR"]


def referral_settings() -> dict:
    return {"reward_minor": referral_reward_minor(), "welcome_minor": referral_welcome_minor()}


def _deep_merge(base: dict, override: dict) -> dict:
    """Fill the default skeleton with stored values, one level deep (the landing
    blob is exactly two levels), so a partially-saved config still returns every
    key the frontend expects."""
    result = {k: dict(v) if isinstance(v, dict) else v for k, v in base.items()}
    for section, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(result.get(section), dict):
            result[section].update({k: v for k, v in value.items() if v is not None or k in result[section]})
        else:
            result[section] = value
    return result


def landing_config() -> dict:
    return _deep_merge(LANDING_DEFAULT, get_json(LANDING_KEY) or {})

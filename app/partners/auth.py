import secrets
from functools import wraps

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from flask import g, request

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.model_mixins import utcnow
from app.extensions import db
from app.partners.models import PartnerApiKey

_ph = PasswordHasher()

KEY_ENV_PREFIX = "sk_partner_"


def generate_api_key() -> tuple[str, str, str]:
    """Returns (plaintext_key, prefix, key_hash). The plaintext is shown to the
    partner once and never stored."""
    prefix = "pk_" + secrets.token_hex(5)  # 10 hex chars, e.g. pk_a1b2c3d4e5
    secret = secrets.token_urlsafe(32)
    plaintext = f"{KEY_ENV_PREFIX}{prefix}.{secret}"
    return plaintext, prefix, _ph.hash(plaintext)


def _extract_key() -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and auth[7:].startswith(KEY_ENV_PREFIX):
        return auth[7:]
    return request.headers.get("X-API-Key")


def _resolve_api_key() -> PartnerApiKey:
    plaintext = _extract_key()
    if not plaintext or not plaintext.startswith(KEY_ENV_PREFIX):
        raise UnauthorizedError("A partner API key is required.")
    try:
        prefix = plaintext[len(KEY_ENV_PREFIX) :].split(".", 1)[0]
    except IndexError:
        raise UnauthorizedError("Malformed API key.") from None

    api_key = PartnerApiKey.query.filter_by(prefix=prefix, is_active=True).first()
    if api_key is None:
        raise UnauthorizedError("Invalid API key.")
    try:
        _ph.verify(api_key.key_hash, plaintext)
    except VerifyMismatchError:
        raise UnauthorizedError("Invalid API key.") from None
    if api_key.partner.status != "active":
        raise ForbiddenError("This partner account is not active.")

    api_key.last_used_at = utcnow()
    db.session.commit()
    return api_key


def require_api_key(*required_scopes: str):
    """Authenticates a partner API request by key and enforces scopes. On
    success, g.partner and g.api_key are set for the handler and the rate
    limiter."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            api_key = _resolve_api_key()
            if required_scopes and not set(required_scopes) <= set(api_key.scopes or []):
                raise ForbiddenError(
                    f"This key lacks the required scope(s): {', '.join(required_scopes)}"
                )
            g.partner = api_key.partner
            g.api_key = api_key
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def _prefix_from_header() -> str | None:
    plaintext = _extract_key()
    if plaintext and plaintext.startswith(KEY_ENV_PREFIX):
        return plaintext[len(KEY_ENV_PREFIX) :].split(".", 1)[0]
    return None


def partner_rate_limit_key() -> str:
    """Flask-Limiter key -- derived from the key prefix in the header so it's
    available before the view runs (per-partner bucket), falling back to IP."""
    prefix = _prefix_from_header()
    return f"partner:{prefix}" if prefix else (request.remote_addr or "anon")


def partner_rate_limit() -> str:
    """Per-partner limit read from the key prefix (one cheap indexed lookup;
    no hashing). Defaults conservatively for unauthenticated callers."""
    prefix = _prefix_from_header()
    if prefix:
        api_key = PartnerApiKey.query.filter_by(prefix=prefix).first()
        if api_key is not None:
            return f"{api_key.partner.rate_limit_per_hour} per hour"
    return "60 per hour"

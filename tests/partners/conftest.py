import pytest

from app.extensions import db
from app.partners.auth import generate_api_key
from app.partners.models import Partner, PartnerApiKey


@pytest.fixture
def partner_factory(app):
    def _make(slug="acme-law", scopes=("cases:read", "cases:write", "documents:write", "webhooks:manage")):
        partner = Partner(name="Acme Law", slug=slug, rate_limit_per_hour=1000)
        db.session.add(partner)
        db.session.flush()
        plaintext, prefix, key_hash = generate_api_key()
        key = PartnerApiKey(
            partner_id=partner.id, name="default", prefix=prefix, key_hash=key_hash, scopes=list(scopes)
        )
        db.session.add(key)
        db.session.commit()
        return partner, plaintext

    return _make


def api_headers(plaintext_key: str) -> dict:
    return {"Authorization": f"Bearer {plaintext_key}"}

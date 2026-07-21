import uuid

from flask_smorest import Blueprint

from app.core.enums import RoleName
from app.core.errors import ConflictError, NotFoundError
from app.core.rbac import require_roles
from app.extensions import db
from app.partners.auth import generate_api_key
from app.partners.models import Partner, PartnerApiKey, PartnerWebhook
from app.partners.schemas import (
    ApiKeyCreatedSchema,
    ApiKeySchema,
    CreateApiKeySchema,
    PartnerSchema,
    PartnerWebhookListSchema,
)
from app.workflow.models import BusinessCase
from app.workflow.schemas import CaseSummarySchema

blp = Blueprint(
    "partner_admin", __name__, url_prefix="/admin/partners", description="Partner management (admin)"
)


@blp.route("", methods=["GET"])
@require_roles(RoleName.ADMIN)
@blp.response(200, PartnerSchema(many=True))
def list_partners_route():
    return Partner.query.order_by(Partner.name).all()


@blp.route("", methods=["POST"])
@require_roles(RoleName.ADMIN)
@blp.arguments(PartnerSchema)
@blp.response(201, PartnerSchema)
def create_partner_route(payload):
    if Partner.query.filter_by(slug=payload["slug"]).first() is not None:
        raise ConflictError("A partner with that slug already exists.")
    partner = Partner(
        name=payload["name"],
        slug=payload["slug"],
        contact_email=payload.get("contact_email"),
        logo_url=payload.get("logo_url"),
        accent_color=payload.get("accent_color", "#131A24"),
        rate_limit_per_hour=payload.get("rate_limit_per_hour", 1000),
    )
    db.session.add(partner)
    db.session.commit()
    return partner


def _partner_or_404(partner_id) -> Partner:
    try:
        partner = Partner.query.get(uuid.UUID(partner_id))
    except ValueError:
        raise NotFoundError("Partner not found") from None
    if partner is None:
        raise NotFoundError("Partner not found")
    return partner


@blp.route("/<string:partner_id>/keys", methods=["GET"])
@require_roles(RoleName.ADMIN)
@blp.response(200, ApiKeySchema(many=True))
def list_keys_route(partner_id):
    partner = _partner_or_404(partner_id)
    return PartnerApiKey.query.filter_by(partner_id=partner.id).order_by(PartnerApiKey.created_at.desc()).all()


@blp.route("/<string:partner_id>/keys", methods=["POST"])
@require_roles(RoleName.ADMIN)
@blp.arguments(CreateApiKeySchema)
@blp.response(201, ApiKeyCreatedSchema)
def create_key_route(payload, partner_id):
    partner = _partner_or_404(partner_id)
    plaintext, prefix, key_hash = generate_api_key()
    api_key = PartnerApiKey(
        partner_id=partner.id,
        name=payload["name"],
        prefix=prefix,
        key_hash=key_hash,
        scopes=payload["scopes"],
    )
    db.session.add(api_key)
    db.session.commit()
    # The plaintext is returned exactly once here.
    return {
        "id": str(api_key.id),
        "name": api_key.name,
        "prefix": api_key.prefix,
        "scopes": api_key.scopes,
        "plaintext_key": plaintext,
    }


@blp.route("/keys/<string:key_id>/revoke", methods=["POST"])
@require_roles(RoleName.ADMIN)
@blp.response(200, ApiKeySchema)
def revoke_key_route(key_id):
    api_key = PartnerApiKey.query.get(uuid.UUID(key_id))
    if api_key is None:
        raise NotFoundError("API key not found")
    api_key.is_active = False
    db.session.commit()
    return api_key


@blp.route("/<string:partner_id>/webhooks", methods=["GET"])
@require_roles(RoleName.ADMIN)
@blp.response(200, PartnerWebhookListSchema(many=True))
def list_partner_webhooks_route(partner_id):
    partner = _partner_or_404(partner_id)
    return PartnerWebhook.query.filter_by(partner_id=partner.id).all()


@blp.route("/<string:partner_id>/cases", methods=["GET"])
@require_roles(RoleName.ADMIN)
@blp.response(200, CaseSummarySchema(many=True))
def list_partner_cases_route(partner_id):
    partner = _partner_or_404(partner_id)
    return (
        BusinessCase.query.filter_by(partner_id=partner.id)
        .order_by(BusinessCase.created_at.desc())
        .all()
    )

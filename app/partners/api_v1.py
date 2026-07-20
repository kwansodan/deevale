import secrets
import uuid

from flask import g
from flask_smorest import Blueprint

from app.auth.models import User
from app.auth.service import get_or_create_role, hash_password
from app.core.enums import RoleName
from app.core.errors import NotFoundError
from app.documents.storage import build_s3_key, presign_put_url
from app.documents.validation import validate_upload_request
from app.extensions import db, limiter
from app.partners.auth import partner_rate_limit, partner_rate_limit_key, require_api_key
from app.partners.schemas import (
    PartnerCaseSummarySchema,
    PartnerCreateCaseSchema,
    PartnerDocumentSlotSchema,
    PartnerWebhookCreateSchema,
    PartnerWebhookListSchema,
    PartnerWebhookSchema,
)
from app.workflow.case_factory import CaseFactory
from app.workflow.models import BusinessCase
from app.workflow.schemas import BusinessCaseSchema

# Versioned partner API. OpenAPI docs are generated for this blueprint like
# any other flask-smorest blueprint (visible at /docs).
blp = Blueprint(
    "partner_v1",
    __name__,
    url_prefix="/api/partner/v1",
    description="Partner API v1 (API-key auth) for law/accounting firms.",
)

# Per-partner rate limit, applied to each route below. The limit value is a
# callable resolved per request from the API key's partner (see auth helpers).
partner_limit = limiter.limit(partner_rate_limit, key_func=partner_rate_limit_key)


def _partner_case_or_404(case_id) -> BusinessCase:
    try:
        case = BusinessCase.query.get(uuid.UUID(str(case_id)))
    except ValueError:
        raise NotFoundError("Case not found") from None
    if case is None or case.partner_id != g.partner.id:
        raise NotFoundError("Case not found")
    return case


@blp.route("/cases", methods=["POST"])
@partner_limit
@require_api_key("cases:write")
@blp.arguments(PartnerCreateCaseSchema)
@blp.response(201, BusinessCaseSchema)
def create_case_route(payload):
    client_data = payload.pop("client")
    # Find or provision the end client. Partner-created accounts start
    # unverified with a random password; the client can claim via reset.
    client_user = User.query.filter_by(email=client_data["email"]).first()
    if client_user is None:
        client_user = User(
            id=uuid.uuid4(),
            email=client_data["email"],
            phone=client_data["phone"],
            full_name=client_data["full_name"],
            password_hash=hash_password(secrets.token_urlsafe(24)),
            is_active=True,
            is_email_verified=False,
            is_phone_verified=False,
        )
        client_user.roles.append(get_or_create_role(RoleName.CLIENT))
        db.session.add(client_user)
        db.session.flush()

    onboarding = {k: v for k, v in payload.items() if k not in ("client",)}
    case = CaseFactory.create_from_onboarding(client_user, onboarding)
    case.partner_id = g.partner.id
    db.session.commit()
    return case


@blp.route("/cases", methods=["GET"])
@partner_limit
@require_api_key("cases:read")
@blp.response(200, PartnerCaseSummarySchema(many=True))
def list_cases_route():
    return (
        BusinessCase.query.filter_by(partner_id=g.partner.id)
        .order_by(BusinessCase.created_at.desc())
        .all()
    )


@blp.route("/cases/<string:case_id>", methods=["GET"])
@partner_limit
@require_api_key("cases:read")
@blp.response(200, BusinessCaseSchema)
def get_case_route(case_id):
    return _partner_case_or_404(case_id)


@blp.route("/cases/<string:case_id>/documents/upload-slot", methods=["POST"])
@partner_limit
@require_api_key("documents:write")
@blp.arguments(PartnerDocumentSlotSchema)
@blp.response(201)
def document_upload_slot_route(payload, case_id):
    case = _partner_case_or_404(case_id)
    validate_upload_request(payload["content_type"], payload["size_bytes"])

    from app.documents.enums import ReviewStatus, UploadStatus
    from app.documents.models import Document, DocumentVersion

    document = Document(
        id=uuid.uuid4(),
        business_case_id=case.id,
        document_type_code=payload["document_type_code"],
        uploaded_by_user_id=case.client_id,
        current_version_number=1,
    )
    db.session.add(document)
    db.session.flush()

    s3_key = build_s3_key(case.id, document.id, 1, payload["original_filename"])
    db.session.add(
        DocumentVersion(
            id=uuid.uuid4(),
            document_id=document.id,
            version_number=1,
            s3_key=s3_key,
            original_filename=payload["original_filename"],
            content_type=payload["content_type"],
            size_bytes=payload["size_bytes"],
            upload_status=UploadStatus.PENDING.value,
            review_status=ReviewStatus.PENDING_REVIEW.value,
        )
    )
    db.session.commit()
    return {
        "document_id": str(document.id),
        "upload_url": presign_put_url(s3_key, payload["content_type"]),
        "s3_key": s3_key,
    }


@blp.route("/webhooks", methods=["POST"])
@partner_limit
@require_api_key("webhooks:manage")
@blp.arguments(PartnerWebhookCreateSchema)
@blp.response(201, PartnerWebhookSchema)
def create_webhook_route(payload):
    from app.partners.models import PartnerWebhook

    webhook = PartnerWebhook(
        partner_id=g.partner.id,
        url=payload["url"],
        secret=secrets.token_urlsafe(32),
        event_types=payload["event_types"],
    )
    db.session.add(webhook)
    db.session.commit()
    return webhook  # secret is returned once here


@blp.route("/webhooks", methods=["GET"])
@partner_limit
@require_api_key("webhooks:manage")
@blp.response(200, PartnerWebhookListSchema(many=True))
def list_webhooks_route():
    from app.partners.models import PartnerWebhook

    return PartnerWebhook.query.filter_by(partner_id=g.partner.id).all()


@blp.route("/webhooks/<string:webhook_id>", methods=["DELETE"])
@partner_limit
@require_api_key("webhooks:manage")
@blp.response(200)
def delete_webhook_route(webhook_id):
    from app.partners.models import PartnerWebhook

    webhook = PartnerWebhook.query.get(uuid.UUID(webhook_id))
    if webhook is None or webhook.partner_id != g.partner.id:
        raise NotFoundError("Webhook not found")
    db.session.delete(webhook)
    db.session.commit()
    return {"message": "deleted"}

import uuid

from flask import request
from flask_jwt_extended import jwt_required
from flask_smorest import Blueprint

from app.core.audit import write_audit_log
from app.core.current_user import get_current_user
from app.core.enums import RoleName
from app.core.errors import ForbiddenError, NotFoundError, ValidationAppError
from app.core.model_mixins import utcnow
from app.core.ownership import ensure_case_access
from app.core.rbac import require_roles
from app.extensions import db
from app.signatures.models import SignatureParty, SignatureRequest, SignatureTemplate
from app.signatures.providers.factory import get_signature_provider
from app.signatures.schemas import (
    CreateSignatureRequestSchema,
    PublicSigningViewSchema,
    SignatureRequestSchema,
    SignatureTemplateSchema,
    SubmitSignatureSchema,
)
from app.signatures.service import (
    all_signed,
    can_party_sign,
    complete_request,
    record_signature,
    render_merged_html,
)
from app.workflow.models import BusinessCase

blp = Blueprint("signatures", __name__, url_prefix="/signatures", description="E-signature requests")


def _case_or_404(case_id) -> BusinessCase:
    try:
        case = BusinessCase.query.get(uuid.UUID(str(case_id)))
    except ValueError:
        raise NotFoundError("Case not found") from None
    if case is None:
        raise NotFoundError("Case not found")
    return case


# --- Templates ---------------------------------------------------------------


@blp.route("/templates", methods=["GET"])
@require_roles(RoleName.CASE_OFFICER, RoleName.ADMIN)
@blp.response(200, SignatureTemplateSchema(many=True))
def list_templates_route():
    return SignatureTemplate.query.order_by(SignatureTemplate.name).all()


@blp.route("/templates", methods=["POST"])
@require_roles(RoleName.ADMIN)
@blp.arguments(SignatureTemplateSchema)
@blp.response(201, SignatureTemplateSchema)
def create_template_route(payload):
    template = SignatureTemplate(
        name=payload["name"], body_html=payload["body_html"], merge_fields=payload.get("merge_fields", [])
    )
    db.session.add(template)
    db.session.commit()
    return template


# --- Requests (staff) --------------------------------------------------------


@blp.route("/requests", methods=["POST"])
@require_roles(RoleName.CASE_OFFICER, RoleName.ADMIN)
@blp.arguments(CreateSignatureRequestSchema)
@blp.response(201, SignatureRequestSchema)
def create_request_route(payload):
    case = _case_or_404(payload["business_case_id"])

    body_html = payload.get("body_html")
    template_id = None
    if payload.get("template_id"):
        template = SignatureTemplate.query.get(uuid.UUID(payload["template_id"]))
        if template is None:
            raise NotFoundError("Template not found")
        body_html = template.body_html
        template_id = template.id
    if not body_html:
        raise ValidationAppError("Provide a template_id or body_html.")

    merged_html = render_merged_html(body_html, payload.get("merge_values", {}))

    signature_request = SignatureRequest(
        id=uuid.uuid4(),
        business_case_id=case.id,
        case_task_id=uuid.UUID(payload["case_task_id"]) if payload.get("case_task_id") else None,
        template_id=template_id,
        title=payload["title"],
        provider=get_signature_provider().name,
        status="draft",
        merged_html=merged_html,
    )
    db.session.add(signature_request)
    db.session.flush()

    for index, party in enumerate(payload["parties"]):
        db.session.add(
            SignatureParty(
                request_id=signature_request.id,
                name=party["name"],
                email=party["email"],
                order_index=index,
            )
        )
    db.session.commit()
    return signature_request


@blp.route("/cases/<string:case_id>/requests", methods=["GET"])
@jwt_required()
@blp.response(200, SignatureRequestSchema(many=True))
def list_case_requests_route(case_id):
    user = get_current_user()
    case = _case_or_404(case_id)
    ensure_case_access(user, case)
    return (
        SignatureRequest.query.filter_by(business_case_id=case.id)
        .order_by(SignatureRequest.created_at.desc())
        .all()
    )


@blp.route("/requests/<string:request_id>/send", methods=["POST"])
@require_roles(RoleName.CASE_OFFICER, RoleName.ADMIN)
@blp.response(200, SignatureRequestSchema)
def send_request_route(request_id):
    signature_request = SignatureRequest.query.get(uuid.UUID(request_id))
    if signature_request is None:
        raise NotFoundError("Signature request not found")
    if signature_request.status != "draft":
        raise ValidationAppError("This request has already been sent.")

    provider = get_signature_provider()
    signature_request.provider_reference = provider.send(signature_request)
    signature_request.status = "sent"
    signature_request.sent_at = utcnow()
    write_audit_log(
        action="signature_request_sent",
        actor_user_id=get_current_user().id,
        entity_type="signature_request",
        entity_id=signature_request.id,
    )
    db.session.commit()
    return signature_request


# --- Signing (public, token-based) -------------------------------------------


def _party_by_token(sign_token: str) -> SignatureParty:
    party = SignatureParty.query.filter_by(sign_token=sign_token).first()
    if party is None:
        raise NotFoundError("Signing link not found")
    return party


@blp.route("/sign/<string:sign_token>", methods=["GET"])
@blp.response(200, PublicSigningViewSchema)
def signing_view_route(sign_token):
    party = _party_by_token(sign_token)
    req = party.request
    return {
        "title": req.title,
        "merged_html": req.merged_html,
        "party_name": party.name,
        "status": req.status,
        "can_sign": req.status == "sent" and can_party_sign(party),
        "already_signed": party.status == "signed",
    }


@blp.route("/sign/<string:sign_token>", methods=["POST"])
@blp.arguments(SubmitSignatureSchema)
@blp.response(200, PublicSigningViewSchema)
def submit_signature_route(payload, sign_token):
    party = _party_by_token(sign_token)
    req = party.request
    if req.status != "sent":
        raise ValidationAppError("This document is not open for signing.")
    if party.status == "signed":
        raise ValidationAppError("You have already signed this document.")
    if not can_party_sign(party):
        raise ForbiddenError("It's not your turn to sign yet — an earlier party must sign first.")

    record_signature(party, payload["signature_type"], payload["signature_data"], request.remote_addr)
    write_audit_log(
        action="signature_recorded",
        actor_user_id=None,
        entity_type="signature_party",
        entity_id=party.id,
        context={"ip": request.remote_addr},
    )

    if all_signed(req):
        complete_request(req)
    else:
        db.session.commit()

    return {
        "title": req.title,
        "merged_html": req.merged_html,
        "party_name": party.name,
        "status": req.status,
        "can_sign": False,
        "already_signed": True,
    }


# --- Webhook (external providers) --------------------------------------------


@blp.route("/webhook/<string:provider_name>", methods=["POST"])
@blp.response(200)
def signature_webhook_route(provider_name):
    provider = get_signature_provider(provider_name)
    try:
        result = provider.parse_webhook(request.get_data(), dict(request.headers))
    except (ValueError, NotImplementedError):
        raise ValidationAppError("Invalid or unsupported webhook.") from None

    signature_request = SignatureRequest.query.filter_by(
        provider_reference=result.provider_reference
    ).first()
    if signature_request is None:
        return {"message": "unknown request"}

    if result.event == "completed" and signature_request.status != "completed":
        for party in signature_request.parties:
            if party.status != "signed":
                party.status = "signed"
                party.signature_type = "provider"
                party.signed_at = utcnow()
        complete_request(signature_request)
    elif result.event == "declined":
        signature_request.status = "declined"
        db.session.commit()

    return {"message": "processed"}

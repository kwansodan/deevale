import uuid
from datetime import timedelta

from flask import current_app, request
from flask_jwt_extended import jwt_required
from flask_smorest import Blueprint

from app.billing.models import has_active_subscription
from app.core.audit import write_audit_log
from app.core.current_user import get_current_user
from app.core.enums import RoleName
from app.core.errors import ForbiddenError, NotFoundError, ValidationAppError
from app.core.model_mixins import utcnow
from app.core.ownership import ensure_case_access
from app.core.rbac import require_roles
from app.extensions import db
from app.mailroom.constants import REGISTERED_ADDRESS_DISCLAIMER
from app.mailroom.models import MailForwardRequest, MailItem, RegisteredAddressEnrollment
from app.mailroom.schemas import (
    DisclaimerSchema,
    EnrollmentSchema,
    EnrollRequestSchema,
    ForwardRequestResponseSchema,
    ForwardRequestSchema,
    ForwardRequestTransitionSchema,
    LogMailRequestSchema,
    MailDownloadUrlSchema,
    MailItemSchema,
    MailScanSlotRequestSchema,
    MailScanSlotResponseSchema,
)
from app.mailroom.storage import build_mail_s3_key, presign_get_url, presign_put_url
from app.workflow.models import BusinessCase

blp = Blueprint("mailroom", __name__, url_prefix="/mailroom", description="Registered address & digital mail room")


def _disclaimer_text() -> str:
    return REGISTERED_ADDRESS_DISCLAIMER.format(retention_days=current_app.config["MAIL_RETENTION_DAYS"])


def _get_case_or_404(case_id) -> BusinessCase:
    if not isinstance(case_id, uuid.UUID):
        try:
            case_id = uuid.UUID(str(case_id))
        except ValueError:
            raise NotFoundError("Case not found") from None
    case = BusinessCase.query.get(case_id)
    if case is None:
        raise NotFoundError("Case not found")
    return case


# --- Enrollment (client) -----------------------------------------------------


@blp.route("/disclaimer", methods=["GET"])
@jwt_required()
@blp.response(200, DisclaimerSchema)
def disclaimer_route():
    user = get_current_user()
    case_id = request.args.get("business_case_id")
    enrolled = False
    if case_id:
        case = _get_case_or_404(case_id)
        ensure_case_access(user, case)
        enrolled = (
            RegisteredAddressEnrollment.query.filter_by(
                business_case_id=case.id, status="active"
            ).first()
            is not None
        )
    return {
        "office_address": current_app.config["REGISTERED_OFFICE_ADDRESS"],
        "disclaimer": _disclaimer_text(),
        "subscription_required": True,
        "enrolled": enrolled,
    }


@blp.route("/enroll", methods=["POST"])
@jwt_required()
@blp.arguments(EnrollRequestSchema)
@blp.response(201, EnrollmentSchema)
def enroll_route(payload):
    user = get_current_user()
    case = _get_case_or_404(payload["business_case_id"])
    ensure_case_access(user, case)

    if not has_active_subscription(case.client_id):
        raise ForbiddenError(
            "The registered address service is part of the LaunchGH compliance plan. "
            "Subscribe to use our office as your registered address."
        )

    existing = RegisteredAddressEnrollment.query.filter_by(business_case_id=case.id).first()
    if existing is not None and existing.status == "active":
        raise ValidationAppError("This case is already enrolled in the registered address service.")

    office_address = current_app.config["REGISTERED_OFFICE_ADDRESS"]
    enrollment = existing or RegisteredAddressEnrollment(
        business_case_id=case.id, client_id=case.client_id
    )
    enrollment.office_address = office_address
    enrollment.consent_text = _disclaimer_text()
    enrollment.consent_ip = request.remote_addr
    enrollment.consented_at = utcnow()
    enrollment.status = "active"
    if existing is None:
        db.session.add(enrollment)

    # Reflect the registered office onto the case (reassign dict so JSONB is dirty).
    case.onboarding_payload = {**(case.onboarding_payload or {}), "registered_office": office_address}

    write_audit_log(
        action="registered_address_enrolled",
        actor_user_id=user.id,
        entity_type="business_case",
        entity_id=case.id,
        context={"office_address": office_address},
    )
    db.session.commit()
    return enrollment


# --- Mail room (staff) -------------------------------------------------------


@blp.route("/mail", methods=["POST"])
@require_roles(RoleName.CASE_OFFICER, RoleName.ADMIN)
@blp.arguments(LogMailRequestSchema)
@blp.response(201, MailItemSchema)
def log_mail_route(payload):
    user = get_current_user()
    case = _get_case_or_404(payload["business_case_id"])

    mail = MailItem(
        business_case_id=case.id,
        client_id=case.client_id,
        logged_by_user_id=user.id,
        sender=payload["sender"],
        subject=payload.get("subject"),
        received_date=payload["received_date"],
        urgency=payload.get("urgency", "normal"),
        status="logged",
    )
    db.session.add(mail)
    write_audit_log(
        action="mail_logged",
        actor_user_id=user.id,
        entity_type="mail_item",
        entity_id=mail.id,
        context={"sender": payload["sender"]},
    )
    db.session.commit()
    return mail


def _get_mail_or_404(mail_id) -> MailItem:
    try:
        mail = MailItem.query.get(uuid.UUID(str(mail_id)))
    except ValueError:
        raise NotFoundError("Mail item not found") from None
    if mail is None:
        raise NotFoundError("Mail item not found")
    return mail


@blp.route("/mail/<string:mail_id>/scan-slot", methods=["POST"])
@require_roles(RoleName.CASE_OFFICER, RoleName.ADMIN)
@blp.arguments(MailScanSlotRequestSchema)
@blp.response(201, MailScanSlotResponseSchema)
def mail_scan_slot_route(payload, mail_id):
    if payload["size_bytes"] > current_app.config["MAX_UPLOAD_SIZE_BYTES"]:
        raise ValidationAppError("Scan exceeds the 10 MB size limit.")
    mail = _get_mail_or_404(mail_id)
    s3_key = build_mail_s3_key(mail.business_case_id, mail.id, payload["original_filename"])
    mail.scan_s3_key = s3_key
    db.session.commit()
    upload_url = presign_put_url(s3_key, payload["content_type"])
    return {"upload_url": upload_url, "s3_key": s3_key}


@blp.route("/mail/<string:mail_id>/scan-confirm", methods=["POST"])
@require_roles(RoleName.CASE_OFFICER, RoleName.ADMIN)
@blp.response(200, MailItemSchema)
def mail_scan_confirm_route(mail_id):
    user = get_current_user()
    mail = _get_mail_or_404(mail_id)
    if mail.scan_s3_key is None:
        raise ValidationAppError("Request a scan slot and upload the PDF before confirming.")

    now = utcnow()
    mail.scan_uploaded_at = now
    mail.status = "scanned"
    mail.shred_after = (now + timedelta(days=current_app.config["MAIL_RETENTION_DAYS"])).date()
    db.session.commit()

    # Notify the client that new mail has arrived.
    from app.auth.models import User
    from app.notifications.dispatcher import dispatcher
    from app.notifications.enums import NotificationCategory

    client_user = User.query.get(mail.client_id)
    if client_user is not None:
        dispatcher.notify(
            client_user,
            NotificationCategory.GOV_PROCESSING_UPDATE,
            {"update_text": f"\U0001f4ec You've received mail from {mail.sender} at your registered address."},
            related_case_id=mail.business_case_id,
        )

    write_audit_log(
        action="mail_scanned",
        actor_user_id=user.id,
        entity_type="mail_item",
        entity_id=mail.id,
    )
    db.session.commit()
    return mail


# --- Client mail inbox -------------------------------------------------------


@blp.route("/mail", methods=["GET"])
@jwt_required()
@blp.response(200, MailItemSchema(many=True))
def list_mail_route():
    user = get_current_user()
    query = MailItem.query.filter(MailItem.status != "shredded")
    if user.has_role(RoleName.CLIENT):
        query = query.filter_by(client_id=user.id, status="scanned")
    else:
        case_id = request.args.get("business_case_id")
        if case_id:
            query = query.filter_by(business_case_id=uuid.UUID(case_id))
    return query.order_by(MailItem.received_date.desc()).all()


@blp.route("/mail/<string:mail_id>/download-url", methods=["GET"])
@jwt_required()
@blp.response(200, MailDownloadUrlSchema)
def mail_download_url_route(mail_id):
    user = get_current_user()
    mail = _get_mail_or_404(mail_id)
    case = _get_case_or_404(mail.business_case_id)
    ensure_case_access(user, case)
    if mail.scan_s3_key is None or mail.status == "shredded":
        raise NotFoundError("No scan is available for this mail item.")

    if user.has_role(RoleName.CLIENT) and mail.read_at is None:
        mail.read_at = utcnow()

    write_audit_log(
        action="mail_accessed",
        actor_user_id=user.id,
        entity_type="mail_item",
        entity_id=mail.id,
    )
    db.session.commit()
    return {"download_url": presign_get_url(mail.scan_s3_key), "expires_in": 300}


@blp.route("/mail/<string:mail_id>/forward", methods=["POST"])
@jwt_required()
@blp.arguments(ForwardRequestSchema)
@blp.response(201, ForwardRequestResponseSchema)
def request_forward_route(payload, mail_id):
    user = get_current_user()
    mail = _get_mail_or_404(mail_id)
    case = _get_case_or_404(mail.business_case_id)
    ensure_case_access(user, case)

    existing = MailForwardRequest.query.filter(
        MailForwardRequest.mail_item_id == mail.id,
        MailForwardRequest.status.in_(["new", "in_progress"]),
    ).first()
    if existing is not None:
        raise ValidationAppError("A forwarding request is already open for this item.")

    forward = MailForwardRequest(
        mail_item_id=mail.id,
        client_id=mail.client_id,
        forwarding_address=payload["forwarding_address"],
    )
    db.session.add(forward)
    write_audit_log(
        action="mail_forward_requested",
        actor_user_id=user.id,
        entity_type="mail_item",
        entity_id=mail.id,
    )
    db.session.commit()
    return forward


# --- Forward queue (staff) ---------------------------------------------------


@blp.route("/forward-requests", methods=["GET"])
@require_roles(RoleName.CASE_OFFICER, RoleName.ADMIN)
@blp.response(200, ForwardRequestResponseSchema(many=True))
def list_forward_requests_route():
    return (
        MailForwardRequest.query.filter(MailForwardRequest.status.in_(["new", "in_progress"]))
        .order_by(MailForwardRequest.created_at)
        .all()
    )


@blp.route("/forward-requests/<string:request_id>/transition", methods=["POST"])
@require_roles(RoleName.CASE_OFFICER, RoleName.ADMIN)
@blp.arguments(ForwardRequestTransitionSchema)
@blp.response(200, ForwardRequestResponseSchema)
def transition_forward_request_route(payload, request_id):
    user = get_current_user()
    try:
        forward = MailForwardRequest.query.get(uuid.UUID(request_id))
    except ValueError:
        raise NotFoundError("Forward request not found") from None
    if forward is None:
        raise NotFoundError("Forward request not found")

    forward.status = payload["status"]
    if forward.handled_by_user_id is None:
        forward.handled_by_user_id = user.id
    if payload["status"] == "done":
        forward.is_forwarded_flag = True
        forward.completed_at = utcnow()
    db.session.commit()
    return forward

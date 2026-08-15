import uuid
from datetime import timedelta

from flask import current_app
from flask_jwt_extended import jwt_required
from flask_smorest import Blueprint

from app.core.current_user import get_current_user
from app.core.enums import RoleName
from app.core.errors import NotFoundError, ValidationAppError
from app.core.model_mixins import utcnow
from app.core.ownership import ensure_case_access
from app.extensions import db
from app.messaging.models import CaseMessage
from app.messaging.schemas import CaseMessageSchema, CreateCaseMessageSchema
from app.notifications.schemas import UnreadCountSchema
from app.workflow.models import BusinessCase

blp = Blueprint("messaging", __name__, url_prefix="/cases", description="Case message thread endpoints")


def _get_case_or_404(case_id: str) -> BusinessCase:
    try:
        case_uuid = uuid.UUID(case_id)
    except ValueError:
        raise NotFoundError("Case not found") from None
    case = BusinessCase.query.get(case_uuid)
    if case is None:
        raise NotFoundError("Case not found")
    return case


@blp.route("/<string:case_id>/messages", methods=["GET"])
@jwt_required()
@blp.response(200, CaseMessageSchema(many=True))
def list_case_messages_route(case_id):
    user = get_current_user()
    case = _get_case_or_404(case_id)
    ensure_case_access(user, case)
    return (
        CaseMessage.query.filter_by(business_case_id=case.id).order_by(CaseMessage.created_at.asc()).all()
    )


@blp.route("/<string:case_id>/messages", methods=["POST"])
@jwt_required()
@blp.arguments(CreateCaseMessageSchema)
@blp.response(201, CaseMessageSchema)
def create_case_message_route(payload, case_id):
    user = get_current_user()
    case = _get_case_or_404(case_id)
    ensure_case_access(user, case)

    attachment_id = None
    if payload.get("attachment_document_id"):
        try:
            attachment_id = uuid.UUID(payload["attachment_document_id"])
        except ValueError:
            raise ValidationAppError("Invalid attachment_document_id") from None

    is_client = user.has_role(RoleName.CLIENT)
    message = CaseMessage(
        id=uuid.uuid4(),
        business_case_id=case.id,
        sender_user_id=user.id,
        body=payload["body"],
        attachment_document_id=attachment_id,
        client_read_at=utcnow() if is_client else None,
        officer_read_at=utcnow() if not is_client else None,
    )
    db.session.add(message)
    db.session.commit()

    try:
        _notify_counterparty(case, sender=user, is_client_sender=is_client, message=message)
    except Exception:  # noqa: BLE001 - a notification failure must not fail the send
        current_app.logger.exception("Failed to notify counterparty of new message")
    return message


# A message alert repeats at most once per this window per recipient+case, so a
# rapid back-and-forth doesn't email someone on every single line.
_MESSAGE_ALERT_WINDOW = timedelta(minutes=15)


def _notify_counterparty(case, sender, is_client_sender, message) -> None:
    """Email + in-app the other side of the thread that a message landed. A
    staff sender notifies the client; a client notifies the assigned officer, or
    -- if none is assigned yet -- the officer/admin pool who would pick the case
    up. Each recipient is alerted at most once per _MESSAGE_ALERT_WINDOW."""
    from app.auth.models import Role, User
    from app.notifications.dispatcher import dispatcher
    from app.notifications.enums import NotificationCategory
    from app.notifications.models import Notification

    if not is_client_sender:
        client = User.query.get(case.client_id)
        recipients = [client] if client is not None else []
    elif case.assigned_officer_id is not None:
        officer = User.query.get(case.assigned_officer_id)
        recipients = [officer] if officer is not None else []
    else:
        recipients = (
            User.query.join(User.roles)
            .filter(Role.name.in_([RoleName.CASE_OFFICER.value, RoleName.ADMIN.value]))
            .distinct()
            .all()
        )

    business_name = (case.onboarding_payload or {}).get("business_name") or case.case_number
    preview = (message.body or "").strip()
    preview = (preview[:80] + "…") if len(preview) > 80 else (preview or "sent an attachment")
    context = {"sender_name": sender.full_name, "business_name": business_name, "preview": preview}

    cutoff = utcnow() - _MESSAGE_ALERT_WINDOW
    for recipient in recipients:
        if recipient.id == sender.id:
            continue
        recent = Notification.query.filter(
            Notification.user_id == recipient.id,
            Notification.category == NotificationCategory.MESSAGE_RECEIVED.value,
            Notification.related_case_id == case.id,
            Notification.created_at >= cutoff,
        ).first()
        if recent is not None:
            continue
        dispatcher.notify(
            recipient, NotificationCategory.MESSAGE_RECEIVED, context, related_case_id=case.id
        )


@blp.route("/<string:case_id>/messages/unread-count", methods=["GET"])
@jwt_required()
@blp.response(200, UnreadCountSchema)
def case_messages_unread_count_route(case_id):
    """Messages from the counterparty this user hasn't opened yet. The client's
    own sent messages are auto-marked read on send, so an unread count is simply
    the rows where this side's read timestamp is still null."""
    user = get_current_user()
    case = _get_case_or_404(case_id)
    ensure_case_access(user, case)

    is_client = user.has_role(RoleName.CLIENT)
    read_column = CaseMessage.client_read_at if is_client else CaseMessage.officer_read_at
    count = CaseMessage.query.filter(
        CaseMessage.business_case_id == case.id, read_column.is_(None)
    ).count()
    return {"count": count}


@blp.route("/<string:case_id>/messages/read", methods=["POST"])
@jwt_required()
@blp.response(200, CaseMessageSchema(many=True))
def mark_case_messages_read_route(case_id):
    user = get_current_user()
    case = _get_case_or_404(case_id)
    ensure_case_access(user, case)

    is_client = user.has_role(RoleName.CLIENT)
    messages = CaseMessage.query.filter_by(business_case_id=case.id).all()
    now = utcnow()
    for message in messages:
        if is_client and message.client_read_at is None:
            message.client_read_at = now
        elif not is_client and message.officer_read_at is None:
            message.officer_read_at = now
    db.session.commit()
    return messages

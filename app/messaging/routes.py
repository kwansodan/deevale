import uuid

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

    message = CaseMessage(
        id=uuid.uuid4(),
        business_case_id=case.id,
        sender_user_id=user.id,
        body=payload["body"],
        attachment_document_id=attachment_id,
        client_read_at=utcnow() if user.has_role(RoleName.CLIENT) else None,
        officer_read_at=utcnow() if not user.has_role(RoleName.CLIENT) else None,
    )
    db.session.add(message)
    db.session.commit()
    return message


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

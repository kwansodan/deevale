import uuid

from flask_jwt_extended import jwt_required
from flask_smorest import Blueprint
from marshmallow import Schema, fields, validate

from app.billing.models import has_active_subscription
from app.compliance.models import ComplianceObligation, ServiceRequest
from app.core.current_user import get_current_user
from app.core.enums import RoleName
from app.core.errors import ForbiddenError, NotFoundError, ValidationAppError
from app.core.model_mixins import utcnow
from app.core.ownership import ensure_case_access
from app.core.rbac import require_roles
from app.extensions import db
from app.workflow.models import BusinessCase

blp = Blueprint("compliance", __name__, url_prefix="/compliance", description="Compliance calendar")


class ObligationSchema(Schema):
    id = fields.String(dump_only=True)
    business_case_id = fields.String(dump_only=True)
    code = fields.String(dump_only=True)
    title = fields.String(dump_only=True)
    description = fields.String(dump_only=True, allow_none=True)
    due_date = fields.Date(dump_only=True)
    recurrence = fields.String(dump_only=True)
    status = fields.String(dump_only=True)


class ServiceRequestSchema(Schema):
    id = fields.String(dump_only=True)
    obligation_id = fields.String(dump_only=True)
    business_case_id = fields.String(dump_only=True)
    client_id = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    assigned_officer_id = fields.String(dump_only=True, allow_none=True)
    note = fields.String(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    obligation_title = fields.Method("get_obligation_title", dump_only=True)

    def get_obligation_title(self, obj):
        obligation = ComplianceObligation.query.get(obj.obligation_id)
        return obligation.title if obligation else None


class ServiceRequestTransitionSchema(Schema):
    status = fields.String(required=True, validate=validate.OneOf(["in_progress", "done"]))
    note = fields.String(load_default=None, allow_none=True)


@blp.route("/obligations", methods=["GET"])
@jwt_required()
@blp.response(200, ObligationSchema(many=True))
def list_obligations_route():
    user = get_current_user()
    query = ComplianceObligation.query
    if user.has_role(RoleName.CLIENT):
        query = query.filter_by(client_id=user.id)
    return query.order_by(ComplianceObligation.due_date).all()


def _get_obligation_for_user(obligation_id, user) -> ComplianceObligation:
    try:
        obligation = ComplianceObligation.query.get(uuid.UUID(obligation_id))
    except ValueError:
        raise NotFoundError("Obligation not found") from None
    if obligation is None:
        raise NotFoundError("Obligation not found")
    case = BusinessCase.query.get(obligation.business_case_id)
    ensure_case_access(user, case)
    return obligation


@blp.route("/obligations/<string:obligation_id>/complete", methods=["POST"])
@jwt_required()
@blp.response(200, ObligationSchema)
def complete_obligation_route(obligation_id):
    """Client marks an obligation as handled themselves."""
    user = get_current_user()
    obligation = _get_obligation_for_user(obligation_id, user)
    obligation.status = "completed"
    db.session.commit()
    return obligation


@blp.route("/obligations/<string:obligation_id>/file-request", methods=["POST"])
@jwt_required()
@blp.response(201, ServiceRequestSchema)
def file_it_for_me_route(obligation_id):
    """'File it for me' -- requires an active compliance subscription."""
    user = get_current_user()
    obligation = _get_obligation_for_user(obligation_id, user)

    if not has_active_subscription(obligation.client_id):
        raise ForbiddenError(
            "'File it for me' is part of the Deevale GH compliance plan. Subscribe to have our team "
            "handle this filing for you."
        )

    existing = ServiceRequest.query.filter(
        ServiceRequest.obligation_id == obligation.id, ServiceRequest.status.in_(["new", "in_progress"])
    ).first()
    if existing is not None:
        raise ValidationAppError("We're already on it — this filing has an open request.")

    service_request = ServiceRequest(
        obligation_id=obligation.id,
        business_case_id=obligation.business_case_id,
        client_id=obligation.client_id,
    )
    db.session.add(service_request)
    obligation.status = "filed_by_us"
    db.session.commit()
    return service_request


@blp.route("/service-requests", methods=["GET"])
@require_roles(RoleName.CASE_OFFICER, RoleName.ADMIN)
@blp.response(200, ServiceRequestSchema(many=True))
def list_service_requests_route():
    return (
        ServiceRequest.query.filter(ServiceRequest.status.in_(["new", "in_progress"]))
        .order_by(ServiceRequest.created_at)
        .all()
    )


@blp.route("/service-requests/<string:request_id>/transition", methods=["POST"])
@require_roles(RoleName.CASE_OFFICER, RoleName.ADMIN)
@blp.arguments(ServiceRequestTransitionSchema)
@blp.response(200, ServiceRequestSchema)
def transition_service_request_route(payload, request_id):
    user = get_current_user()
    try:
        service_request = ServiceRequest.query.get(uuid.UUID(request_id))
    except ValueError:
        raise NotFoundError("Service request not found") from None
    if service_request is None:
        raise NotFoundError("Service request not found")

    service_request.status = payload["status"]
    service_request.note = payload.get("note") or service_request.note
    if payload["status"] == "in_progress" and service_request.assigned_officer_id is None:
        service_request.assigned_officer_id = user.id
    if payload["status"] == "done":
        service_request.completed_at = utcnow()
        obligation = ComplianceObligation.query.get(service_request.obligation_id)
        if obligation is not None:
            obligation.status = "completed"
    db.session.commit()
    return service_request

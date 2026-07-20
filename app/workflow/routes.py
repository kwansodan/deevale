import uuid

from flask_jwt_extended import jwt_required
from flask_smorest import Blueprint

from app.core.current_user import get_current_user
from app.core.enums import RoleName
from app.core.errors import NotFoundError, ValidationAppError
from app.core.ownership import ensure_case_access
from app.core.rbac import require_roles
from app.extensions import db
from app.workflow.case_factory import CaseFactory
from app.workflow.enums import StageStatus, TaskStatus
from app.workflow.models import BusinessCase, CaseStage, CaseTask, OnboardingDraft
from app.workflow.quote_service import preview_quote
from app.workflow.schemas import (
    AssignCaseRequestSchema,
    AuditLogEntrySchema,
    BusinessCaseSchema,
    CaseListQuerySchema,
    CaseSummarySchema,
    OnboardingCaseCreateSchema,
    OnboardingDraftSchema,
    PaginatedCasesSchema,
    QuotePreviewRequestSchema,
    QuotePreviewResponseSchema,
    StageTransitionRequestSchema,
    TaskCompleteRequestSchema,
    TaskTransitionRequestSchema,
)
from app.workflow.state_machine import StageStateMachine, TaskStateMachine

blp = Blueprint("workflow", __name__, url_prefix="/cases", description="Business case and workflow endpoints")


def _get_case_or_404(case_id: str) -> BusinessCase:
    from sqlalchemy.orm import selectinload

    try:
        case_uuid = uuid.UUID(case_id)
    except ValueError:
        raise NotFoundError("Case not found") from None
    # Eager-load the stage/task tree the detail serializer walks (avoids N+1).
    case = (
        BusinessCase.query.options(selectinload(BusinessCase.stages).selectinload(CaseStage.tasks))
        .filter(BusinessCase.id == case_uuid)
        .first()
    )
    if case is None:
        raise NotFoundError("Case not found")
    return case


def _get_task_or_404(case: BusinessCase, task_id: str) -> CaseTask:
    try:
        task_uuid = uuid.UUID(task_id)
    except ValueError:
        raise NotFoundError("Task not found") from None
    task = CaseTask.query.get(task_uuid)
    if task is None or task.case_stage.business_case_id != case.id:
        raise NotFoundError("Task not found")
    return task


@blp.route("", methods=["GET"])
@jwt_required()
@blp.response(200, CaseSummarySchema(many=True))
def list_cases_route():
    user = get_current_user()
    query = BusinessCase.query
    if user.has_role(RoleName.CLIENT):
        query = query.filter_by(client_id=user.id)
    return query.order_by(BusinessCase.created_at.desc()).all()


@blp.route("/queue", methods=["GET"])
@require_roles(RoleName.CASE_OFFICER, RoleName.REVIEWER, RoleName.FINANCE, RoleName.ADMIN)
@blp.arguments(CaseListQuerySchema, location="query")
@blp.response(200, PaginatedCasesSchema)
def case_queue_route(params):
    """Staff case queue with server-side pagination and filters."""
    query = BusinessCase.query
    if params.get("status"):
        query = query.filter(BusinessCase.status == params["status"])
    if params.get("entity_type"):
        query = query.filter(BusinessCase.entity_type == params["entity_type"])
    if params.get("assigned_officer_id"):
        if params["assigned_officer_id"] == "unassigned":
            query = query.filter(BusinessCase.assigned_officer_id.is_(None))
        else:
            try:
                query = query.filter(
                    BusinessCase.assigned_officer_id == uuid.UUID(params["assigned_officer_id"])
                )
            except ValueError:
                raise ValidationAppError("Invalid assigned_officer_id") from None
    if params.get("stage_code"):
        query = query.join(CaseStage, CaseStage.business_case_id == BusinessCase.id).filter(
            CaseStage.code == params["stage_code"],
            CaseStage.status.in_(["in_progress", "blocked_on_payment", "not_started"]),
        )
    if params.get("sla"):
        from datetime import timedelta

        from app.core.model_mixins import utcnow

        open_statuses = ("pending", "in_progress", "awaiting_client", "awaiting_review")
        task_query = (
            db.session.query(CaseStage.business_case_id)
            .join(CaseTask, CaseTask.case_stage_id == CaseStage.id)
            .filter(CaseTask.status.in_(open_statuses))
        )
        if params["sla"] == "breached":
            task_query = task_query.filter(CaseTask.sla_breached_at.isnot(None))
        elif params["sla"] == "breaching_soon":
            task_query = task_query.filter(
                CaseTask.sla_breached_at.is_(None),
                CaseTask.sla_due_at.isnot(None),
                CaseTask.sla_due_at <= utcnow() + timedelta(hours=24),
            )
        else:
            raise ValidationAppError("sla filter must be 'breached' or 'breaching_soon'")
        query = query.filter(BusinessCase.id.in_(task_query.subquery()))

    page = max(params["page"], 1)
    page_size = min(max(params["page_size"], 1), 100)
    total = query.count()
    # Eager-load stages + tasks: the summary serializer reads them for the SLA
    # and current-stage columns, which would otherwise be N+1 per row.
    from sqlalchemy.orm import selectinload

    items = (
        query.options(selectinload(BusinessCase.stages).selectinload(CaseStage.tasks))
        .order_by(BusinessCase.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@blp.route("/<string:case_id>/assign", methods=["POST"])
@require_roles(RoleName.CASE_OFFICER, RoleName.ADMIN)
@blp.arguments(AssignCaseRequestSchema)
@blp.response(200, CaseSummarySchema)
def assign_case_route(payload, case_id):
    from app.auth.models import User

    user = get_current_user()
    case = _get_case_or_404(case_id)

    try:
        officer_id = uuid.UUID(payload["officer_id"])
    except ValueError:
        raise ValidationAppError("Invalid officer_id") from None
    officer = User.query.get(officer_id)
    if officer is None or not officer.has_role(RoleName.CASE_OFFICER):
        raise ValidationAppError("The selected user is not a case officer")

    case.assigned_officer_id = officer.id
    from app.core.audit import write_audit_log

    write_audit_log(
        action="case_assigned",
        actor_user_id=user.id,
        entity_type="business_case",
        entity_id=case.id,
        context={"officer_id": str(officer.id)},
    )
    db.session.commit()
    return case


@blp.route("/<string:case_id>/audit-logs", methods=["GET"])
@require_roles(RoleName.CASE_OFFICER, RoleName.REVIEWER, RoleName.FINANCE, RoleName.ADMIN)
@blp.response(200, AuditLogEntrySchema(many=True))
def case_audit_logs_route(case_id):
    from app.core.models import AuditLog

    case = _get_case_or_404(case_id)

    # A case's audit trail spans several entity types (case, stages, tasks,
    # documents) -- collect the ids that belong to this case.
    stage_ids = [str(s.id) for s in case.stages]
    task_ids = [str(t.id) for s in case.stages for t in s.tasks]
    from app.documents.models import Document, DocumentVersion

    documents = Document.query.filter_by(business_case_id=case.id).all()
    document_ids = [str(d.id) for d in documents]
    version_ids = [
        str(v.id)
        for v in DocumentVersion.query.filter(
            DocumentVersion.document_id.in_([d.id for d in documents])
        ).all()
    ]

    related_ids = [str(case.id), *stage_ids, *task_ids, *document_ids, *version_ids]
    return (
        AuditLog.query.filter(AuditLog.entity_id.in_(related_ids))
        .order_by(AuditLog.created_at.desc())
        .limit(500)
        .all()
    )


@blp.route("", methods=["POST"])
@jwt_required()
@blp.arguments(OnboardingCaseCreateSchema)
@blp.response(201, BusinessCaseSchema)
def create_case_route(payload):
    user = get_current_user()
    case = CaseFactory.create_from_onboarding(user, payload)
    OnboardingDraft.query.filter_by(user_id=user.id).delete()
    db.session.commit()
    return case


@blp.route("/quote-preview", methods=["POST"])
@jwt_required()
@blp.arguments(QuotePreviewRequestSchema)
@blp.response(200, QuotePreviewResponseSchema)
def quote_preview_route(payload):
    return preview_quote(payload["entity_type"], payload.get("foreign_participation", False))


@blp.route("/onboarding-draft", methods=["GET"])
@jwt_required()
@blp.response(200, OnboardingDraftSchema)
def get_onboarding_draft_route():
    user = get_current_user()
    draft = OnboardingDraft.query.filter_by(user_id=user.id).first()
    if draft is None:
        return {"payload": {}, "current_step": 1}
    return draft


@blp.route("/onboarding-draft", methods=["PUT"])
@jwt_required()
@blp.arguments(OnboardingDraftSchema)
@blp.response(200, OnboardingDraftSchema)
def put_onboarding_draft_route(payload):
    user = get_current_user()
    draft = OnboardingDraft.query.filter_by(user_id=user.id).first()
    if draft is None:
        draft = OnboardingDraft(user_id=user.id)
        db.session.add(draft)
    draft.payload = payload["payload"]
    draft.current_step = payload["current_step"]
    db.session.commit()
    return draft


@blp.route("/<string:case_id>", methods=["GET"])
@jwt_required()
@blp.response(200, BusinessCaseSchema)
def get_case_route(case_id):
    user = get_current_user()
    case = _get_case_or_404(case_id)
    ensure_case_access(user, case)
    return case


@blp.route("/<string:case_id>/stages/<string:stage_id>/transition", methods=["POST"])
@jwt_required()
@blp.arguments(StageTransitionRequestSchema)
@blp.response(200, BusinessCaseSchema)
def transition_stage_route(payload, case_id, stage_id):
    user = get_current_user()
    case = _get_case_or_404(case_id)
    ensure_case_access(user, case)

    try:
        stage_uuid = uuid.UUID(stage_id)
    except ValueError:
        raise NotFoundError("Stage not found") from None
    stage = CaseStage.query.get(stage_uuid)
    if stage is None or stage.business_case_id != case.id:
        raise NotFoundError("Stage not found")

    try:
        new_status = StageStatus(payload["new_status"])
    except ValueError:
        raise ValidationAppError(f"Unknown stage status '{payload['new_status']}'") from None

    StageStateMachine.transition(stage, new_status, actor=user, note=payload.get("note"))
    db.session.commit()
    return case


@blp.route("/<string:case_id>/tasks/<string:task_id>/transition", methods=["POST"])
@jwt_required()
@blp.arguments(TaskTransitionRequestSchema)
@blp.response(200, BusinessCaseSchema)
def transition_task_route(payload, case_id, task_id):
    user = get_current_user()
    case = _get_case_or_404(case_id)
    ensure_case_access(user, case)
    task = _get_task_or_404(case, task_id)

    try:
        new_status = TaskStatus(payload["new_status"])
    except ValueError:
        raise ValidationAppError(f"Unknown task status '{payload['new_status']}'") from None

    TaskStateMachine.transition(task, new_status, actor=user, note=payload.get("note"))
    db.session.commit()
    return case


@blp.route("/<string:case_id>/tasks/<string:task_id>/complete", methods=["POST"])
@jwt_required()
@blp.arguments(TaskCompleteRequestSchema)
@blp.response(200, BusinessCaseSchema)
def complete_task_route(payload, case_id, task_id):
    """Client-facing endpoint: a client may only move their own task forward
    -- into awaiting_review (if it needs staff/document review) or straight
    to done (for simple data-entry tasks with no document requirement)."""
    user = get_current_user()
    case = _get_case_or_404(case_id)
    ensure_case_access(user, case)
    task = _get_task_or_404(case, task_id)

    if task.assignee_type != "client":
        raise ValidationAppError("This task is not assigned to the client")

    target = TaskStatus.AWAITING_REVIEW if task.requires_document else TaskStatus.DONE
    TaskStateMachine.transition(task, target, actor=user, note=payload.get("note"))
    db.session.commit()
    return case

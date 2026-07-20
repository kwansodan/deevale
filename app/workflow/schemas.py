from marshmallow import INCLUDE, Schema, fields

from app.workflow.enums import AssigneeType, TaskStatus, task_status_display


class OnboardingCaseCreateSchema(Schema):
    class Meta:
        unknown = INCLUDE  # onboarding wizard (1.9) grows this payload over time

    entity_type = fields.String(required=True)


class QuoteLineItemSchema(Schema):
    id = fields.String(dump_only=True)
    label = fields.String(dump_only=True)
    amount_minor = fields.Integer(dump_only=True)
    fee_type = fields.String(dump_only=True)


class QuoteSchema(Schema):
    id = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    subtotal_government_minor = fields.Integer(dump_only=True)
    subtotal_service_minor = fields.Integer(dump_only=True)
    total_minor = fields.Integer(dump_only=True)
    currency = fields.String(dump_only=True)
    line_items = fields.List(fields.Nested(QuoteLineItemSchema), dump_only=True)


class CaseTaskSchema(Schema):
    id = fields.String(dump_only=True)
    code = fields.String(dump_only=True)
    name = fields.String(dump_only=True)
    description = fields.String(dump_only=True, allow_none=True)
    status = fields.String(dump_only=True)
    status_display = fields.Method("get_status_display", dump_only=True)
    assignee_type = fields.String(dump_only=True)
    is_required = fields.Boolean(dump_only=True)
    requires_document = fields.Boolean(dump_only=True)
    required_document_type = fields.String(dump_only=True, allow_none=True)
    linked_document_id = fields.String(dump_only=True, allow_none=True)
    government_reference_note = fields.String(dump_only=True, allow_none=True)
    deadline_at = fields.DateTime(dump_only=True, allow_none=True)
    completed_at = fields.DateTime(dump_only=True, allow_none=True)

    def get_status_display(self, obj) -> str:
        return task_status_display(TaskStatus(obj.status), AssigneeType(obj.assignee_type))


class CaseStageSchema(Schema):
    id = fields.String(dump_only=True)
    code = fields.String(dump_only=True)
    name = fields.String(dump_only=True)
    sequence_order = fields.Integer(dump_only=True)
    status = fields.String(dump_only=True)
    is_gated_by_payment = fields.Boolean(dump_only=True)
    started_at = fields.DateTime(dump_only=True, allow_none=True)
    completed_at = fields.DateTime(dump_only=True, allow_none=True)
    deadline_at = fields.DateTime(dump_only=True, allow_none=True)
    tasks = fields.List(fields.Nested(CaseTaskSchema), dump_only=True)


class BusinessCaseSchema(Schema):
    id = fields.String(dump_only=True)
    case_number = fields.String(dump_only=True)
    client_id = fields.String(dump_only=True)
    assigned_officer_id = fields.String(dump_only=True, allow_none=True)
    entity_type = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    onboarding_payload = fields.Dict(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    stages = fields.List(fields.Nested(CaseStageSchema), dump_only=True)
    quote = fields.Nested(QuoteSchema, dump_only=True, allow_none=True)
    client = fields.Method("get_client", dump_only=True)

    def get_client(self, obj):
        from app.auth.models import User

        user = User.query.get(obj.client_id)
        if user is None:
            return None
        return {"id": str(user.id), "full_name": user.full_name, "email": user.email, "phone": user.phone}


class CaseSummarySchema(Schema):
    id = fields.String(dump_only=True)
    case_number = fields.String(dump_only=True)
    entity_type = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    assigned_officer_id = fields.String(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    business_name = fields.Method("get_business_name", dump_only=True)
    current_stage_name = fields.Method("get_current_stage_name", dump_only=True)
    next_sla_due_at = fields.Method("get_next_sla_due_at", dump_only=True)
    sla_breached = fields.Method("get_sla_breached", dump_only=True)

    _OPEN_TASK_STATUSES = ("pending", "in_progress", "awaiting_client", "awaiting_review")

    def get_business_name(self, obj):
        payload = obj.onboarding_payload or {}
        return payload.get("business_name") or obj.case_number

    def get_current_stage_name(self, obj):
        active = [s for s in obj.stages if s.status in ("in_progress", "blocked_on_payment", "not_started")]
        return active[0].name if active else None

    def _open_tasks(self, obj):
        return [t for s in obj.stages for t in s.tasks if t.status in self._OPEN_TASK_STATUSES]

    def get_next_sla_due_at(self, obj):
        due_dates = [t.sla_due_at for t in self._open_tasks(obj) if t.sla_due_at is not None]
        return min(due_dates).isoformat() if due_dates else None

    def get_sla_breached(self, obj):
        return any(t.sla_breached_at is not None for t in self._open_tasks(obj))


class PaginatedCasesSchema(Schema):
    items = fields.List(fields.Nested(CaseSummarySchema), dump_only=True)
    total = fields.Integer(dump_only=True)
    page = fields.Integer(dump_only=True)
    page_size = fields.Integer(dump_only=True)


class CaseListQuerySchema(Schema):
    page = fields.Integer(load_default=1)
    page_size = fields.Integer(load_default=20)
    status = fields.String(load_default=None)
    entity_type = fields.String(load_default=None)
    stage_code = fields.String(load_default=None)
    assigned_officer_id = fields.String(load_default=None)
    sla = fields.String(load_default=None)  # "breached" | "breaching_soon"


class AssignCaseRequestSchema(Schema):
    officer_id = fields.String(required=True)


class AuditLogEntrySchema(Schema):
    id = fields.String(dump_only=True)
    actor_user_id = fields.String(dump_only=True, allow_none=True)
    action = fields.String(dump_only=True)
    entity_type = fields.String(dump_only=True, allow_none=True)
    entity_id = fields.String(dump_only=True, allow_none=True)
    context = fields.Dict(dump_only=True)
    created_at = fields.DateTime(dump_only=True)


class QuotePreviewRequestSchema(Schema):
    entity_type = fields.String(required=True)
    foreign_participation = fields.Boolean(load_default=False)


class QuotePreviewLineItemSchema(Schema):
    label = fields.String(dump_only=True)
    amount_minor = fields.Integer(dump_only=True)
    fee_type = fields.String(dump_only=True)


class QuotePreviewResponseSchema(Schema):
    line_items = fields.List(fields.Nested(QuotePreviewLineItemSchema), dump_only=True)
    subtotal_government_minor = fields.Integer(dump_only=True)
    subtotal_service_minor = fields.Integer(dump_only=True)
    total_minor = fields.Integer(dump_only=True)
    currency = fields.String(dump_only=True)


class OnboardingDraftSchema(Schema):
    payload = fields.Dict(required=True)
    current_step = fields.Integer(required=True)
    updated_at = fields.DateTime(dump_only=True)


class StageTransitionRequestSchema(Schema):
    new_status = fields.String(required=True)
    note = fields.String(required=False, allow_none=True)


class TaskTransitionRequestSchema(Schema):
    new_status = fields.String(required=True)
    note = fields.String(required=False, allow_none=True)


class TaskCompleteRequestSchema(Schema):
    note = fields.String(required=False, allow_none=True)

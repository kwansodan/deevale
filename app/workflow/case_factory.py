import uuid
from datetime import UTC, datetime

from sqlalchemy import func

from app.core.audit import write_audit_log
from app.core.errors import ValidationAppError
from app.core.events.bus import bus
from app.core.events.events import CaseCreated
from app.extensions import db
from app.workflow.enums import CaseStatus, EntityType, StageStatus, TaskStatus
from app.workflow.models import BusinessCase, CaseStage, CaseTask, WorkflowDefinition
from app.workflow.quote_service import compute_quote
from app.workflow.state_machine import StageStateMachine

SUPPORTED_ENTITY_TYPES = {
    EntityType.COMPANY_LIMITED_BY_SHARES.value,
    EntityType.PARTNERSHIP.value,
    EntityType.COMPANY_LIMITED_BY_GUARANTEE.value,
    EntityType.EXTERNAL_COMPANY.value,
}

# Case-number prefix. Was "LGH" (LaunchGH) before the rename.
CASE_NUMBER_PREFIX = "DGH"

# Statuses that count as an in-flight registration for idempotency purposes;
# COMPLETED / CANCELLED are terminal, so the same business may be started again.
_IN_FLIGHT_STATUSES = (
    CaseStatus.DRAFT.value,
    CaseStatus.ACTIVE.value,
    CaseStatus.BLOCKED.value,
)


class CaseFactory:
    @staticmethod
    def create_from_onboarding(client, onboarding_payload: dict) -> BusinessCase:
        entity_type = onboarding_payload.get("entity_type")
        if entity_type not in SUPPORTED_ENTITY_TYPES:
            raise ValidationAppError(
                f"Entity type '{entity_type}' is not yet supported for case creation."
            )

        # Foreign participation routes onto the GIPC-inclusive workflow track.
        variant = "foreign" if onboarding_payload.get("gipc_required") else "standard"
        workflow_def = (
            WorkflowDefinition.query.filter_by(entity_type=entity_type, variant=variant, is_active=True)
            .order_by(WorkflowDefinition.version.desc())
            .first()
        )
        if workflow_def is None and variant == "foreign":
            # No dedicated foreign track for this entity type -- fall back to
            # standard rather than blocking the case outright.
            workflow_def = (
                WorkflowDefinition.query.filter_by(
                    entity_type=entity_type, variant="standard", is_active=True
                )
                .order_by(WorkflowDefinition.version.desc())
                .first()
            )
        if workflow_def is None:
            raise ValidationAppError(f"No active workflow definition found for entity type '{entity_type}'")

        # Idempotency: repeated onboarding submissions -- a retry after an error,
        # a double-click, a flaky connection -- must not each mint a new case.
        # If this client already has an in-flight case for the same entity type
        # and business name, return it rather than creating a duplicate. This
        # guards the partner API path too, since it shares this factory.
        business_name = (onboarding_payload.get("business_name") or "").strip()
        if business_name:
            existing = BusinessCase.query.filter(
                BusinessCase.client_id == client.id,
                BusinessCase.entity_type == entity_type,
                BusinessCase.status.in_(_IN_FLIGHT_STATUSES),
                func.lower(BusinessCase.onboarding_payload["business_name"].astext)
                == business_name.lower(),
            ).first()
            if existing is not None:
                return existing

        case = BusinessCase(
            id=uuid.uuid4(),
            case_number=_generate_case_number(),
            client_id=client.id,
            entity_type=entity_type,
            workflow_definition_id=workflow_def.id,
            status=CaseStatus.ACTIVE.value,
            onboarding_payload=onboarding_payload,
        )
        db.session.add(case)
        db.session.flush()

        for stage_def in workflow_def.stage_definitions:
            stage = CaseStage(
                id=uuid.uuid4(),
                business_case_id=case.id,
                stage_definition_id=stage_def.id,
                code=stage_def.code,
                name=stage_def.name,
                sequence_order=stage_def.sequence_order,
                status=StageStatus.LOCKED.value,
                is_gated_by_payment=stage_def.is_gated_by_payment,
            )
            db.session.add(stage)
            db.session.flush()

            for task_def in stage_def.task_definitions:
                db.session.add(
                    CaseTask(
                        id=uuid.uuid4(),
                        case_stage_id=stage.id,
                        task_definition_id=task_def.id,
                        code=task_def.code,
                        name=task_def.name,
                        description=task_def.description,
                        sequence_order=task_def.sequence_order,
                        status=TaskStatus.PENDING.value,
                        assignee_type=task_def.assignee_type,
                        is_required=task_def.is_required,
                        requires_document=task_def.requires_document,
                        required_document_type=task_def.required_document_type,
                        allowed_transition_roles=task_def.allowed_transition_roles,
                    )
                )

        db.session.flush()

        compute_quote(case)

        first_stage = min(case.stages, key=lambda s: s.sequence_order)
        StageStateMachine.transition(first_stage, StageStatus.NOT_STARTED, actor=None)
        if not first_stage.is_gated_by_payment:
            StageStateMachine.transition(first_stage, StageStatus.IN_PROGRESS, actor=None)

        write_audit_log(
            action="case_created", actor_user_id=client.id, entity_type="business_case", entity_id=case.id
        )
        bus.dispatch(CaseCreated(case_id=case.id))

        db.session.flush()
        return case


def _generate_case_number() -> str:
    year = datetime.now(UTC).year
    prefix = f"{CASE_NUMBER_PREFIX}-{year}-"
    # Take the highest existing sequence, not count()+1: count() reuses a number
    # after a case is deleted, which then collides with the unique case_number.
    # Zero-padding makes lexical order match numeric order, so desc gives the max.
    last = (
        BusinessCase.query.filter(BusinessCase.case_number.like(f"{prefix}%"))
        .order_by(BusinessCase.case_number.desc())
        .first()
    )
    next_seq = 1 if last is None else int(last.case_number.rsplit("-", 1)[1]) + 1
    return f"{prefix}{next_seq:06d}"

import uuid
from datetime import UTC, datetime

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
    count = BusinessCase.query.filter(BusinessCase.case_number.like(f"LGH-{year}-%")).count() + 1
    return f"LGH-{year}-{count:06d}"

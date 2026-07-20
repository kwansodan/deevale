from datetime import timedelta

from app.core.audit import write_audit_log
from app.core.enums import RoleName
from app.core.errors import ForbiddenError, GuardViolationError
from app.core.events.bus import bus
from app.core.events.events import StageCompleted, StageStarted, TaskAwaitingClient
from app.core.model_mixins import utcnow
from app.workflow.enums import AssigneeType, StageStatus, TaskStatus
from app.workflow.models import CaseStage, CaseTask


def _require_role(actor, allowed: set[RoleName]) -> None:
    """actor=None means a system/event-handler-triggered transition -- these
    bypass role checks entirely since there is no HTTP caller to authorize."""
    if actor is None:
        return
    if actor.has_role(RoleName.ADMIN):
        return
    if not any(actor.has_role(r) for r in allowed):
        raise ForbiddenError("Your role does not permit this transition")


def _require_client_actor(actor) -> None:
    if actor is None:
        return
    if not actor.has_role(RoleName.CLIENT):
        raise ForbiddenError("Only the client may perform this transition")


def _task_allowed_roles(task: CaseTask) -> set[RoleName]:
    if task.allowed_transition_roles:
        return {RoleName(r) for r in task.allowed_transition_roles}
    return {RoleName.CASE_OFFICER, RoleName.ADMIN}


def _guard_task_done(task: CaseTask) -> None:
    if not task.requires_document:
        return
    from app.documents.models import Document

    if task.linked_document_id is None:
        raise GuardViolationError("This task requires an approved document before it can be completed")
    document = Document.query.get(task.linked_document_id)
    current_version = document.current_version() if document else None
    if current_version is None or current_version.review_status != "approved":
        raise GuardViolationError("The linked document must be approved before this task can be completed")


class TaskStateMachine:
    ALLOWED_TRANSITIONS = {
        (TaskStatus.PENDING, TaskStatus.IN_PROGRESS),
        (TaskStatus.PENDING, TaskStatus.AWAITING_REVIEW),
        (TaskStatus.PENDING, TaskStatus.DONE),
        (TaskStatus.IN_PROGRESS, TaskStatus.AWAITING_REVIEW),
        (TaskStatus.IN_PROGRESS, TaskStatus.DONE),
        (TaskStatus.AWAITING_CLIENT, TaskStatus.AWAITING_REVIEW),
        (TaskStatus.AWAITING_REVIEW, TaskStatus.DONE),
        (TaskStatus.AWAITING_REVIEW, TaskStatus.AWAITING_CLIENT),
        (TaskStatus.PENDING, TaskStatus.SKIPPED),
        (TaskStatus.IN_PROGRESS, TaskStatus.SKIPPED),
        (TaskStatus.AWAITING_CLIENT, TaskStatus.SKIPPED),
    }

    @staticmethod
    def transition(task: CaseTask, new_status: TaskStatus, actor=None, note: str | None = None) -> CaseTask:
        current = TaskStatus(task.status)
        if (current, new_status) not in TaskStateMachine.ALLOWED_TRANSITIONS:
            raise GuardViolationError(f"Cannot move task from {current.value} to {new_status.value}")

        if new_status == TaskStatus.SKIPPED:
            _require_role(actor, {RoleName.ADMIN})
        elif task.assignee_type == AssigneeType.STAFF.value:
            _require_role(actor, _task_allowed_roles(task))
        else:
            _require_client_actor(actor)

        if new_status == TaskStatus.DONE:
            _guard_task_done(task)

        task.status = new_status.value
        if new_status == TaskStatus.DONE:
            task.completed_at = utcnow()

        write_audit_log(
            action="task_transition",
            actor_user_id=actor.id if actor else None,
            entity_type="case_task",
            entity_id=task.id,
            context={"from": current.value, "to": new_status.value, "note": note},
        )

        if new_status == TaskStatus.AWAITING_CLIENT:
            bus.dispatch(TaskAwaitingClient(case_id=task.case_stage.business_case_id, task_id=task.id))

        return task


class StageStateMachine:
    ALLOWED_TRANSITIONS = {
        (StageStatus.LOCKED, StageStatus.NOT_STARTED),
        (StageStatus.LOCKED, StageStatus.BLOCKED_ON_PAYMENT),
        (StageStatus.NOT_STARTED, StageStatus.IN_PROGRESS),
        (StageStatus.BLOCKED_ON_PAYMENT, StageStatus.IN_PROGRESS),
        (StageStatus.IN_PROGRESS, StageStatus.COMPLETED),
    }

    @staticmethod
    def transition(stage: CaseStage, new_status: StageStatus, actor=None, note: str | None = None) -> CaseStage:
        current = StageStatus(stage.status)
        if (current, new_status) not in StageStateMachine.ALLOWED_TRANSITIONS:
            raise GuardViolationError(f"Cannot move stage from {current.value} to {new_status.value}")

        if new_status == StageStatus.COMPLETED:
            _require_role(actor, {RoleName.CASE_OFFICER, RoleName.ADMIN})
            _guard_stage_completion(stage)

        stage.status = new_status.value
        now = utcnow()
        if new_status == StageStatus.IN_PROGRESS and stage.started_at is None:
            stage.started_at = now
            if stage.stage_definition and stage.stage_definition.deadline_days:
                stage.deadline_at = now + timedelta(days=stage.stage_definition.deadline_days)
            if stage.stage_definition and stage.stage_definition.sla_hours:
                from app.core.business_days import (
                    add_business_days,
                    load_holidays,
                    sla_hours_to_business_days,
                )

                sla_due = add_business_days(
                    now,
                    sla_hours_to_business_days(stage.stage_definition.sla_hours),
                    load_holidays(),
                )
                for task in stage.tasks:
                    if task.sla_due_at is None:
                        task.sla_due_at = sla_due
        if new_status == StageStatus.COMPLETED:
            stage.completed_at = now

        write_audit_log(
            action="stage_transition",
            actor_user_id=actor.id if actor else None,
            entity_type="case_stage",
            entity_id=stage.id,
            context={"from": current.value, "to": new_status.value, "note": note},
        )

        if new_status == StageStatus.IN_PROGRESS:
            bus.dispatch(StageStarted(case_id=stage.business_case_id, stage_id=stage.id))
        if new_status == StageStatus.COMPLETED:
            bus.dispatch(StageCompleted(case_id=stage.business_case_id, stage_id=stage.id))

        return stage


def _guard_stage_completion(stage: CaseStage) -> None:
    for task in stage.tasks:
        if task.is_required and task.status not in (TaskStatus.DONE.value, TaskStatus.SKIPPED.value):
            raise GuardViolationError(
                f"Cannot complete stage: required task '{task.name}' is not done (status={task.status})"
            )

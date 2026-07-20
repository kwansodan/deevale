"""Domain event subscribers that produce side effects within the workflow
domain itself: unblocking a payment-gated stage on payment.received,
advancing to the next stage when one completes, and updating a CaseTask when
its linked document is approved/rejected.
"""

from app.core.events.bus import DomainEventBus
from app.core.events.events import DocumentApproved, DocumentRejected, PaymentReceived, StageCompleted
from app.extensions import db
from app.workflow.enums import CaseStatus, StageStatus, TaskStatus
from app.workflow.models import BusinessCase, CaseStage, CaseTask
from app.workflow.state_machine import StageStateMachine, TaskStateMachine


def _case_has_paid_invoice(case: BusinessCase) -> bool:
    from app.payments.models import Invoice

    return (
        Invoice.query.filter_by(business_case_id=case.id, status="paid").first() is not None
    )


def _advance_next_stage(case: BusinessCase, completed_stage: CaseStage) -> None:
    next_stage = CaseStage.query.filter(
        CaseStage.business_case_id == case.id,
        CaseStage.sequence_order == completed_stage.sequence_order + 1,
    ).first()
    if next_stage is None:
        return

    # A payment-gated stage only blocks if the case hasn't already paid --
    # clients typically pay right after onboarding, well before this stage
    # is reached, and payment.received fired back then with nothing to unblock.
    if next_stage.is_gated_by_payment and not _case_has_paid_invoice(case):
        StageStateMachine.transition(next_stage, StageStatus.BLOCKED_ON_PAYMENT, actor=None)
    else:
        StageStateMachine.transition(next_stage, StageStatus.NOT_STARTED, actor=None)
        StageStateMachine.transition(next_stage, StageStatus.IN_PROGRESS, actor=None)


def handle_stage_completed(event: StageCompleted) -> None:
    stage = CaseStage.query.get(event.stage_id)
    case = BusinessCase.query.get(event.case_id)
    if stage is None or case is None:
        return

    if stage.code == "completed":
        case.status = CaseStatus.COMPLETED.value
        db.session.flush()
        # A finished registration seeds the client's compliance calendar.
        from app.compliance.service import generate_obligations

        generate_obligations(case)
        return

    _advance_next_stage(case, stage)
    db.session.flush()


def handle_payment_received(event: PaymentReceived) -> None:
    blocked_stages = CaseStage.query.filter(
        CaseStage.business_case_id == event.case_id,
        CaseStage.status == StageStatus.BLOCKED_ON_PAYMENT.value,
    ).all()
    for stage in blocked_stages:
        StageStateMachine.transition(stage, StageStatus.IN_PROGRESS, actor=None)
    db.session.flush()


def handle_document_approved(event: DocumentApproved) -> None:
    if not event.task_id:
        return
    task = CaseTask.query.get(event.task_id)
    if task is None or task.status == TaskStatus.DONE.value:
        return
    TaskStateMachine.transition(task, TaskStatus.DONE, actor=None)
    db.session.flush()


def handle_document_rejected(event: DocumentRejected) -> None:
    if not event.task_id:
        return
    task = CaseTask.query.get(event.task_id)
    if task is None:
        return
    if task.status == TaskStatus.AWAITING_REVIEW.value:
        TaskStateMachine.transition(task, TaskStatus.AWAITING_CLIENT, actor=None)
    db.session.flush()


def register(bus: DomainEventBus) -> None:
    bus.register("stage.completed", handle_stage_completed)
    bus.register("payment.received", handle_payment_received)
    bus.register("document.approved", handle_document_approved)
    bus.register("document.rejected", handle_document_rejected)

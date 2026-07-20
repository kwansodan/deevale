from app.auth.models import User
from app.core.enums import RoleName
from app.core.events.bus import DomainEventBus
from app.core.events.events import (
    CaseBlocked,
    DeadlineApproaching,
    DocumentRejected,
    DocumentUploaded,
    InvoiceSent,
    PaymentReceived,
    StageCompleted,
    TaskAwaitingClient,
)
from app.documents.models import Document
from app.notifications.dispatcher import dispatcher
from app.notifications.enums import NotificationCategory
from app.payments.models import Invoice
from app.workflow.models import BusinessCase, CaseStage, CaseTask


def _business_name(case: BusinessCase) -> str:
    payload = case.onboarding_payload or {}
    return payload.get("business_name") or payload.get("proposed_name") or case.case_number


def _client_of(case: BusinessCase) -> User | None:
    return User.query.get(case.client_id)


def _staff_recipients(case: BusinessCase) -> list[User]:
    if case.assigned_officer_id:
        officer = User.query.get(case.assigned_officer_id)
        if officer is not None:
            return [officer]
    return User.query.filter(User.roles.any(name=RoleName.CASE_OFFICER.value)).all()


def handle_stage_completed(event: StageCompleted) -> None:
    stage = CaseStage.query.get(event.stage_id)
    case = BusinessCase.query.get(event.case_id)
    if stage is None or case is None or stage.code == "completed":
        return
    client = _client_of(case)
    if client is None:
        return
    dispatcher.notify(
        client,
        NotificationCategory.STAGE_COMPLETED,
        {
            "stage_name": stage.name,
            "business_name": _business_name(case),
            "next_step": "We're moving on to the next step.",
        },
        related_case_id=case.id,
    )


def handle_task_awaiting_client(event: TaskAwaitingClient) -> None:
    task = CaseTask.query.get(event.task_id)
    case = BusinessCase.query.get(event.case_id)
    client = _client_of(case) if case else None
    if task is None or case is None or client is None:
        return
    dispatcher.notify(
        client,
        NotificationCategory.ACTION_REQUIRED,
        {"task_name": task.name, "business_name": _business_name(case)},
        related_case_id=case.id,
    )


def handle_document_rejected(event: DocumentRejected) -> None:
    document = Document.query.get(event.document_id)
    case = BusinessCase.query.get(event.case_id)
    client = _client_of(case) if case else None
    if document is None or case is None or client is None:
        return
    dispatcher.notify(
        client,
        NotificationCategory.DOCUMENT_REJECTED,
        {
            "document_type": document.document_type_code.replace("_", " "),
            "business_name": _business_name(case),
            "reason": (event.reason_code or "").replace("_", " "),
            "note": event.note,
        },
        related_case_id=case.id,
    )


def handle_payment_received(event: PaymentReceived) -> None:
    case = BusinessCase.query.get(event.case_id)
    if case is None:
        return
    context = {"business_name": _business_name(case), "case_number": case.case_number}
    client = _client_of(case)
    if client is not None:
        dispatcher.notify(client, NotificationCategory.PAYMENT_RECEIVED, context, related_case_id=case.id)
    for staff in _staff_recipients(case):
        dispatcher.notify(staff, NotificationCategory.STAFF_PAYMENT_RECEIVED, context, related_case_id=case.id)


def handle_deadline_approaching(event: DeadlineApproaching) -> None:
    case = BusinessCase.query.get(event.case_id)
    client = _client_of(case) if case else None
    if case is None or client is None:
        return
    dispatcher.notify(
        client,
        NotificationCategory.DEADLINE_COUNTDOWN,
        {
            "business_name": _business_name(case),
            "days_remaining": event.days_remaining,
            "entity_label": (event.entity_type or "").replace("_", " "),
        },
        related_case_id=case.id,
    )


def handle_case_blocked(event: CaseBlocked) -> None:
    case = BusinessCase.query.get(event.case_id)
    client = _client_of(case) if case else None
    if case is None or client is None:
        return
    dispatcher.notify(
        client,
        NotificationCategory.CASE_BLOCKED,
        {"business_name": _business_name(case), "reason": event.reason},
        related_case_id=case.id,
    )


def handle_document_uploaded(event: DocumentUploaded) -> None:
    document = Document.query.get(event.document_id)
    case = BusinessCase.query.get(event.case_id)
    if document is None or case is None:
        return
    uploader = User.query.get(document.uploaded_by_user_id)
    context = {
        "client_name": uploader.full_name if uploader else "A client",
        "case_number": case.case_number,
    }
    for staff in _staff_recipients(case):
        dispatcher.notify(staff, NotificationCategory.STAFF_NEW_UPLOAD, context, related_case_id=case.id)


def handle_invoice_sent(event: InvoiceSent) -> None:
    invoice = Invoice.query.get(event.invoice_id)
    case = BusinessCase.query.get(event.case_id)
    client = _client_of(case) if case else None
    if invoice is None or case is None or client is None:
        return
    dispatcher.notify(
        client,
        NotificationCategory.PAYMENT_DUE,
        {
            "business_name": _business_name(case),
            "invoice_number": invoice.invoice_number,
            "amount": f"{invoice.total_minor / 100:.2f}",
        },
        related_case_id=case.id,
    )


def register(bus: DomainEventBus) -> None:
    bus.register("stage.completed", handle_stage_completed)
    bus.register("task.awaiting_client", handle_task_awaiting_client)
    bus.register("document.rejected", handle_document_rejected)
    bus.register("payment.received", handle_payment_received)
    bus.register("deadline.approaching", handle_deadline_approaching)
    bus.register("case.blocked", handle_case_blocked)
    bus.register("document.uploaded", handle_document_uploaded)
    bus.register("invoice.sent", handle_invoice_sent)

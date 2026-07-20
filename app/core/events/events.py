import uuid
from dataclasses import dataclass
from typing import ClassVar


@dataclass(frozen=True)
class DomainEvent:
    event_type: ClassVar[str] = "domain.event"


@dataclass(frozen=True)
class CaseCreated(DomainEvent):
    event_type: ClassVar[str] = "case.created"
    case_id: uuid.UUID


@dataclass(frozen=True)
class StageStarted(DomainEvent):
    event_type: ClassVar[str] = "stage.started"
    case_id: uuid.UUID
    stage_id: uuid.UUID


@dataclass(frozen=True)
class StageCompleted(DomainEvent):
    event_type: ClassVar[str] = "stage.completed"
    case_id: uuid.UUID
    stage_id: uuid.UUID


@dataclass(frozen=True)
class TaskAwaitingClient(DomainEvent):
    event_type: ClassVar[str] = "task.awaiting_client"
    case_id: uuid.UUID
    task_id: uuid.UUID


@dataclass(frozen=True)
class DocumentApproved(DomainEvent):
    event_type: ClassVar[str] = "document.approved"
    case_id: uuid.UUID
    document_id: uuid.UUID
    task_id: uuid.UUID | None = None


@dataclass(frozen=True)
class DocumentRejected(DomainEvent):
    event_type: ClassVar[str] = "document.rejected"
    case_id: uuid.UUID
    document_id: uuid.UUID
    reason_code: str = ""
    note: str = ""
    task_id: uuid.UUID | None = None


@dataclass(frozen=True)
class PaymentReceived(DomainEvent):
    event_type: ClassVar[str] = "payment.received"
    case_id: uuid.UUID
    invoice_id: uuid.UUID
    payment_id: uuid.UUID


@dataclass(frozen=True)
class DeadlineApproaching(DomainEvent):
    event_type: ClassVar[str] = "deadline.approaching"
    case_id: uuid.UUID
    entity_type: str = ""
    entity_id: uuid.UUID | None = None
    days_remaining: int = 0


@dataclass(frozen=True)
class CaseBlocked(DomainEvent):
    event_type: ClassVar[str] = "case.blocked"
    case_id: uuid.UUID
    reason: str = ""


@dataclass(frozen=True)
class DocumentUploaded(DomainEvent):
    """Used for the staff-side 'new client upload' alert (not in the core PRD
    event list but needed to drive the staff_new_upload notification trigger)."""

    event_type: ClassVar[str] = "document.uploaded"
    case_id: uuid.UUID
    document_id: uuid.UUID


@dataclass(frozen=True)
class InvoiceSent(DomainEvent):
    """Used for the payment_due notification trigger (not in the core PRD
    event list but needed since invoice creation isn't otherwise a case/stage/
    task/document/payment event)."""

    event_type: ClassVar[str] = "invoice.sent"
    case_id: uuid.UUID
    invoice_id: uuid.UUID

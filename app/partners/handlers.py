"""Fans domain events for partner-owned cases out to the partner webhook
delivery pipeline. Registered on the bus via the events registry."""

from app.core.events.bus import DomainEventBus


def _dispatch(event_type: str, case_id, data: dict) -> None:
    from app.partners.webhooks import dispatch_case_event

    dispatch_case_event(event_type, case_id, data)


def handle_case_created(event) -> None:
    _dispatch("case.created", event.case_id, {})


def handle_stage_completed(event) -> None:
    from app.workflow.models import CaseStage

    stage = CaseStage.query.get(event.stage_id)
    _dispatch("stage.completed", event.case_id, {"stage_code": stage.code if stage else None})


def handle_document_approved(event) -> None:
    _dispatch("document.approved", event.case_id, {"document_id": str(event.document_id)})


def handle_document_rejected(event) -> None:
    _dispatch(
        "document.rejected",
        event.case_id,
        {"document_id": str(event.document_id), "reason_code": event.reason_code},
    )


def handle_payment_received(event) -> None:
    _dispatch("payment.received", event.case_id, {"invoice_id": str(event.invoice_id)})


def handle_case_blocked(event) -> None:
    _dispatch("case.blocked", event.case_id, {"reason": event.reason})


def register(bus: DomainEventBus) -> None:
    bus.register("case.created", handle_case_created)
    bus.register("stage.completed", handle_stage_completed)
    bus.register("document.approved", handle_document_approved)
    bus.register("document.rejected", handle_document_rejected)
    bus.register("payment.received", handle_payment_received)
    bus.register("case.blocked", handle_case_blocked)

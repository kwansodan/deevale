import uuid
from datetime import UTC, datetime

from app.core.errors import ValidationAppError
from app.core.events.bus import bus
from app.core.events.events import InvoiceSent
from app.core.model_mixins import utcnow
from app.extensions import db
from app.payments.enums import InvoiceStatus
from app.payments.models import Invoice, InvoiceLineItem
from app.workflow.models import BusinessCase


def create_invoice_from_case(case: BusinessCase) -> Invoice:
    if case.quote is None:
        raise ValidationAppError("This case has no finalized quote yet")

    existing = Invoice.query.filter(
        Invoice.business_case_id == case.id,
        Invoice.status.in_([InvoiceStatus.DRAFT.value, InvoiceStatus.SENT.value]),
    ).first()
    if existing is not None:
        return existing

    invoice = Invoice(
        id=uuid.uuid4(),
        business_case_id=case.id,
        quote_id=case.quote.id,
        invoice_number=_generate_invoice_number(),
        status=InvoiceStatus.SENT.value,
        subtotal_government_minor=case.quote.subtotal_government_minor,
        subtotal_service_minor=case.quote.subtotal_service_minor,
        total_minor=case.quote.total_minor,
        currency=case.quote.currency,
        sent_at=utcnow(),
    )
    db.session.add(invoice)
    db.session.flush()

    for index, line in enumerate(case.quote.line_items):
        db.session.add(
            InvoiceLineItem(
                id=uuid.uuid4(),
                invoice_id=invoice.id,
                label=line.label,
                amount_minor=line.amount_minor,
                fee_type=line.fee_type,
                sequence_order=index,
            )
        )
    db.session.flush()

    # Apply any referral/welcome credits the client has accrued.
    from app.referrals.service import apply_credits_to_invoice

    apply_credits_to_invoice(invoice)

    db.session.commit()

    bus.dispatch(InvoiceSent(case_id=case.id, invoice_id=invoice.id))
    db.session.commit()

    return invoice


def _generate_invoice_number() -> str:
    year = datetime.now(UTC).year
    count = Invoice.query.filter(Invoice.invoice_number.like(f"INV-{year}-%")).count() + 1
    return f"INV-{year}-{count:06d}"


def mark_invoice_paid(invoice: Invoice) -> None:
    invoice.status = InvoiceStatus.PAID.value
    invoice.paid_at = utcnow()
    db.session.flush()


def mark_invoice_failed(invoice: Invoice) -> None:
    invoice.status = InvoiceStatus.FAILED.value
    db.session.flush()

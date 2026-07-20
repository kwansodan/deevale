import hashlib
import uuid

from flask import request
from flask_jwt_extended import jwt_required
from flask_smorest import Blueprint

from app.core.audit import write_audit_log
from app.core.current_user import get_current_user
from app.core.enums import RoleName
from app.core.errors import NotFoundError, ValidationAppError
from app.core.events.bus import bus
from app.core.events.events import PaymentReceived
from app.core.model_mixins import utcnow
from app.core.ownership import ensure_case_access
from app.core.rbac import require_roles
from app.extensions import db
from app.payments.enums import InvoiceStatus, PaymentStatus
from app.payments.invoice_service import create_invoice_from_case, mark_invoice_paid
from app.payments.models import Invoice, Payment, PaymentEvent
from app.payments.providers.factory import get_payment_provider
from app.payments.schemas import (
    InitializeTransactionResponseSchema,
    InvoiceSchema,
    ManualCreditRequestSchema,
    PaymentSchema,
    RefundLogRequestSchema,
    WebhookAckSchema,
)
from app.workflow.models import BusinessCase

blp = Blueprint("payments", __name__, url_prefix="/payments", description="Invoicing and payment endpoints")


def _get_case_or_404(case_uuid) -> BusinessCase:
    case = BusinessCase.query.get(case_uuid)
    if case is None:
        raise NotFoundError("Case not found")
    return case


def _get_invoice_or_404(invoice_id) -> Invoice:
    try:
        invoice_uuid = uuid.UUID(invoice_id)
    except ValueError:
        raise NotFoundError("Invoice not found") from None
    invoice = Invoice.query.get(invoice_uuid)
    if invoice is None:
        raise NotFoundError("Invoice not found")
    return invoice


@blp.route("/cases/<string:case_id>/invoice", methods=["POST"])
@jwt_required()
@blp.response(201, InvoiceSchema)
def create_invoice_route(case_id):
    user = get_current_user()
    try:
        case_uuid = uuid.UUID(case_id)
    except ValueError:
        raise NotFoundError("Case not found") from None
    case = _get_case_or_404(case_uuid)
    ensure_case_access(user, case)

    return create_invoice_from_case(case)


@blp.route("/invoices/<string:invoice_id>/initialize-transaction", methods=["POST"])
@jwt_required()
@blp.response(200, InitializeTransactionResponseSchema)
def initialize_transaction_route(invoice_id):
    user = get_current_user()
    invoice = _get_invoice_or_404(invoice_id)
    case = _get_case_or_404(invoice.business_case_id)
    ensure_case_access(user, case)

    if invoice.status == InvoiceStatus.PAID.value:
        raise ValidationAppError("This invoice has already been paid")

    provider = get_payment_provider()
    callback_url = request.args.get("callback_url", "")
    result = provider.initialize_transaction(invoice=invoice, customer_email=user.email, callback_url=callback_url)

    payment = Payment(
        id=uuid.uuid4(),
        invoice_id=invoice.id,
        provider="paystack",
        provider_reference=result.provider_reference,
        channel="card",
        amount_minor=invoice.total_minor,
        currency=invoice.currency,
        status=PaymentStatus.INITIALIZED.value,
    )
    db.session.add(payment)
    db.session.commit()

    return {"authorization_url": result.authorization_url, "provider_reference": result.provider_reference}


@blp.route("/webhook/paystack", methods=["POST"])
@blp.response(200, WebhookAckSchema)
def paystack_webhook_route():
    provider = get_payment_provider()
    signature = request.headers.get("x-paystack-signature", "")
    event = provider.parse_webhook(request.get_data(), signature)

    dedup_key = hashlib.sha256(
        f"{event.provider_reference}:{event.status}:{event.amount_minor}".encode()
    ).hexdigest()

    existing = PaymentEvent.query.filter_by(provider="paystack", dedup_key=dedup_key).first()
    if existing is not None:
        return {"message": "already processed"}

    payment_event = PaymentEvent(provider="paystack", dedup_key=dedup_key, raw_payload=event.raw)
    db.session.add(payment_event)
    db.session.flush()

    # Subscription charges carry our SUB- reference; route them to billing.
    if event.provider_reference.startswith("SUB-"):
        from app.billing.routes import activate_subscription_by_reference, handle_subscription_failure

        if event.status == "success":
            activate_subscription_by_reference(event.provider_reference)
        else:
            handle_subscription_failure(event.provider_reference)
        payment_event.processed_at = utcnow()
        db.session.commit()
        return {"message": "processed"}

    payment = (
        Payment.query.filter_by(provider_reference=event.provider_reference)
        .order_by(Payment.created_at.desc())
        .first()
    )
    if payment is None:
        payment_event.processed_at = utcnow()
        db.session.commit()
        return {"message": "no matching payment"}

    invoice = Invoice.query.get(payment.invoice_id)

    if event.status == "success":
        payment.status = PaymentStatus.SUCCESS.value
        payment.paid_at = utcnow()
        payment.channel = event.channel
        mark_invoice_paid(invoice)
        payment_event.processed_at = utcnow()
        db.session.commit()

        bus.dispatch(
            PaymentReceived(case_id=invoice.business_case_id, invoice_id=invoice.id, payment_id=payment.id)
        )
        db.session.commit()

        from app.payments.tasks import generate_receipt_pdf

        generate_receipt_pdf.delay(str(invoice.id))
    else:
        payment.status = PaymentStatus.FAILED.value
        invoice.status = InvoiceStatus.FAILED.value
        payment_event.processed_at = utcnow()
        db.session.commit()

    return {"message": "processed"}


@blp.route("/cases/<string:case_id>/invoices", methods=["GET"])
@jwt_required()
@blp.response(200, InvoiceSchema(many=True))
def list_case_invoices_route(case_id):
    """Payment history for a case -- staff see any case, clients their own."""
    user = get_current_user()
    try:
        case_uuid = uuid.UUID(case_id)
    except ValueError:
        raise NotFoundError("Case not found") from None
    case = _get_case_or_404(case_uuid)
    ensure_case_access(user, case)
    return Invoice.query.filter_by(business_case_id=case.id).order_by(Invoice.created_at.desc()).all()


@blp.route("/finance/payments", methods=["GET"])
@require_roles(RoleName.FINANCE, RoleName.ADMIN)
@blp.response(200, PaymentSchema(many=True))
def list_payments_route():
    return Payment.query.order_by(Payment.created_at.desc()).all()


@blp.route("/finance/invoices/<string:invoice_id>/manual-credit", methods=["POST"])
@require_roles(RoleName.FINANCE, RoleName.ADMIN)
@blp.arguments(ManualCreditRequestSchema)
@blp.response(201, PaymentSchema)
def manual_credit_route(payload, invoice_id):
    user = get_current_user()
    invoice = _get_invoice_or_404(invoice_id)

    payment = Payment(
        id=uuid.uuid4(),
        invoice_id=invoice.id,
        provider="manual",
        channel="manual",
        amount_minor=payload["amount_minor"],
        currency=invoice.currency,
        status=PaymentStatus.SUCCESS.value,
        is_manual_credit=True,
        recorded_by_user_id=user.id,
        note=payload.get("note"),
        paid_at=utcnow(),
    )
    db.session.add(payment)
    db.session.flush()

    total_paid = sum(
        p.amount_minor for p in invoice.payments if p.status == PaymentStatus.SUCCESS.value
    )
    if total_paid >= invoice.total_minor:
        mark_invoice_paid(invoice)

    write_audit_log(
        action="manual_credit_recorded",
        actor_user_id=user.id,
        entity_type="invoice",
        entity_id=invoice.id,
        context={"amount_minor": payload["amount_minor"], "note": payload.get("note")},
    )
    db.session.commit()

    if invoice.status == InvoiceStatus.PAID.value:
        bus.dispatch(
            PaymentReceived(case_id=invoice.business_case_id, invoice_id=invoice.id, payment_id=payment.id)
        )
        db.session.commit()

    return payment


@blp.route("/finance/invoices/<string:invoice_id>/refund-log", methods=["POST"])
@require_roles(RoleName.FINANCE, RoleName.ADMIN)
@blp.arguments(RefundLogRequestSchema)
@blp.response(201, PaymentSchema)
def refund_log_route(payload, invoice_id):
    """Records that a refund was issued -- the actual refund transaction is
    performed manually in the Paystack dashboard (v1); this just keeps our
    ledger honest."""
    user = get_current_user()
    invoice = _get_invoice_or_404(invoice_id)

    payment = Payment(
        id=uuid.uuid4(),
        invoice_id=invoice.id,
        provider="manual",
        channel="manual",
        amount_minor=payload["amount_minor"],
        currency=invoice.currency,
        status=PaymentStatus.REFUNDED.value,
        is_manual_credit=False,
        recorded_by_user_id=user.id,
        note=payload.get("note"),
        paid_at=utcnow(),
    )
    db.session.add(payment)
    invoice.status = InvoiceStatus.REFUNDED.value

    write_audit_log(
        action="refund_recorded",
        actor_user_id=user.id,
        entity_type="invoice",
        entity_id=invoice.id,
        context={"amount_minor": payload["amount_minor"], "note": payload.get("note")},
    )
    db.session.commit()
    return payment

import csv
import io
import uuid
from datetime import date

from flask import Response, current_app, request
from flask_jwt_extended import jwt_required
from flask_smorest import Blueprint

from app.bookkeeping.constants import EXPENSE_CATEGORIES
from app.bookkeeping.models import BusinessProfile, ClientInvoice, Expense
from app.bookkeeping.schemas import (
    BusinessProfileSchema,
    CategorySchema,
    ClientInvoiceSchema,
    ExpenseSchema,
    PublicInvoiceSchema,
    ReceiptSlotRequestSchema,
    ReceiptSlotResponseSchema,
)
from app.bookkeeping.service import (
    generate_share_token,
    next_invoice_number,
    set_line_items,
)
from app.core.current_user import get_current_user
from app.core.errors import NotFoundError, ValidationAppError
from app.core.model_mixins import utcnow
from app.core.ownership import ensure_case_access
from app.documents.storage import presign_get_url, presign_put_url
from app.extensions import db
from app.workflow.models import BusinessCase

blp = Blueprint("bookkeeping", __name__, url_prefix="/bookkeeping", description="Client invoicing & light bookkeeping")


def _case_or_404(case_id) -> BusinessCase:
    try:
        case = BusinessCase.query.get(uuid.UUID(str(case_id)))
    except ValueError:
        raise NotFoundError("Case not found") from None
    if case is None:
        raise NotFoundError("Case not found")
    return case


def _authed_case(case_id) -> BusinessCase:
    case = _case_or_404(case_id)
    ensure_case_access(get_current_user(), case)
    return case


# --- Categories --------------------------------------------------------------


@blp.route("/categories", methods=["GET"])
@jwt_required()
@blp.response(200, CategorySchema(many=True))
def categories_route():
    return [{"code": code, "label": label} for code, label in EXPENSE_CATEGORIES]


# --- Business profile --------------------------------------------------------


@blp.route("/cases/<string:case_id>/profile", methods=["GET"])
@jwt_required()
@blp.response(200, BusinessProfileSchema)
def get_profile_route(case_id):
    case = _authed_case(case_id)
    profile = BusinessProfile.query.filter_by(business_case_id=case.id).first()
    if profile is None:
        payload = case.onboarding_payload or {}
        return BusinessProfile(
            business_case_id=case.id,
            client_id=case.client_id,
            display_name=payload.get("business_name", case.case_number),
        )
    return profile


@blp.route("/cases/<string:case_id>/profile", methods=["PUT"])
@jwt_required()
@blp.arguments(BusinessProfileSchema)
@blp.response(200, BusinessProfileSchema)
def put_profile_route(payload, case_id):
    case = _authed_case(case_id)
    profile = BusinessProfile.query.filter_by(business_case_id=case.id).first()
    if profile is None:
        profile = BusinessProfile(business_case_id=case.id, client_id=case.client_id)
        db.session.add(profile)
    for field in ("display_name", "address", "default_currency", "is_vat_registered", "vat_rate_bps", "vat_number"):
        if field in payload:
            setattr(profile, field, payload[field])
    db.session.commit()
    return profile


# --- Invoices ----------------------------------------------------------------


def _invoice_or_404(invoice_id) -> ClientInvoice:
    try:
        invoice = ClientInvoice.query.get(uuid.UUID(str(invoice_id)))
    except ValueError:
        raise NotFoundError("Invoice not found") from None
    if invoice is None:
        raise NotFoundError("Invoice not found")
    ensure_case_access(get_current_user(), _case_or_404(invoice.business_case_id))
    return invoice


@blp.route("/cases/<string:case_id>/invoices", methods=["POST"])
@jwt_required()
@blp.arguments(ClientInvoiceSchema)
@blp.response(201, ClientInvoiceSchema)
def create_invoice_route(payload, case_id):
    case = _authed_case(case_id)
    invoice = ClientInvoice(
        id=uuid.uuid4(),
        business_case_id=case.id,
        client_id=case.client_id,
        invoice_number=next_invoice_number(case.id),
        customer_name=payload["customer_name"],
        customer_email=payload.get("customer_email"),
        currency=payload.get("currency", "GHS"),
        status="draft",
        issue_date=payload.get("issue_date") or date.today(),
        due_date=payload.get("due_date"),
        notes=payload.get("notes"),
        vat_rate_bps=payload.get("vat_rate_bps", 0),
    )
    db.session.add(invoice)
    db.session.flush()
    set_line_items(invoice, payload["line_items"])
    db.session.commit()
    return invoice


@blp.route("/cases/<string:case_id>/invoices", methods=["GET"])
@jwt_required()
@blp.response(200, ClientInvoiceSchema(many=True))
def list_invoices_route(case_id):
    case = _authed_case(case_id)
    return (
        ClientInvoice.query.filter_by(business_case_id=case.id)
        .order_by(ClientInvoice.created_at.desc())
        .all()
    )


@blp.route("/invoices/<string:invoice_id>", methods=["GET"])
@jwt_required()
@blp.response(200, ClientInvoiceSchema)
def get_invoice_route(invoice_id):
    return _invoice_or_404(invoice_id)


@blp.route("/invoices/<string:invoice_id>", methods=["PUT"])
@jwt_required()
@blp.arguments(ClientInvoiceSchema)
@blp.response(200, ClientInvoiceSchema)
def update_invoice_route(payload, invoice_id):
    invoice = _invoice_or_404(invoice_id)
    if invoice.status != "draft":
        raise ValidationAppError("Only draft invoices can be edited.")
    invoice.customer_name = payload["customer_name"]
    invoice.customer_email = payload.get("customer_email")
    invoice.currency = payload.get("currency", invoice.currency)
    invoice.issue_date = payload.get("issue_date") or invoice.issue_date
    invoice.due_date = payload.get("due_date")
    invoice.notes = payload.get("notes")
    invoice.vat_rate_bps = payload.get("vat_rate_bps", 0)
    set_line_items(invoice, payload["line_items"])
    db.session.commit()
    return invoice


@blp.route("/invoices/<string:invoice_id>/send", methods=["POST"])
@jwt_required()
@blp.response(200, ClientInvoiceSchema)
def send_invoice_route(invoice_id):
    invoice = _invoice_or_404(invoice_id)
    if invoice.status == "paid":
        raise ValidationAppError("This invoice is already paid.")
    if invoice.share_token is None:
        invoice.share_token = generate_share_token()
    invoice.status = "sent"
    invoice.sent_at = utcnow()
    db.session.commit()

    from app.bookkeeping.tasks import generate_invoice_pdf

    generate_invoice_pdf.delay(str(invoice.id))
    return invoice


@blp.route("/invoices/<string:invoice_id>/mark-paid", methods=["POST"])
@jwt_required()
@blp.response(200, ClientInvoiceSchema)
def mark_paid_route(invoice_id):
    invoice = _invoice_or_404(invoice_id)
    invoice.status = "paid"
    invoice.paid_at = utcnow()
    db.session.commit()
    return invoice


@blp.route("/invoices/<string:invoice_id>/pdf-url", methods=["GET"])
@jwt_required()
@blp.response(200)
def invoice_pdf_url_route(invoice_id):
    invoice = _invoice_or_404(invoice_id)
    if invoice.pdf_s3_key is None:
        raise NotFoundError("The invoice PDF isn't ready yet.")
    return {"download_url": presign_get_url(invoice.pdf_s3_key), "expires_in": 300}


@blp.route("/invoices/shared/<string:share_token>", methods=["GET"])
@blp.response(200, PublicInvoiceSchema)
def public_invoice_route(share_token):
    """Public share link -- no auth. Only sent/paid/overdue invoices are
    viewable, and only a customer-safe subset of fields is returned."""
    invoice = ClientInvoice.query.filter_by(share_token=share_token).first()
    if invoice is None or invoice.status == "draft":
        raise NotFoundError("Invoice not found")
    profile = BusinessProfile.query.filter_by(business_case_id=invoice.business_case_id).first()
    business_name = profile.display_name if profile else "Business"
    return {
        "invoice_number": invoice.invoice_number,
        "business_name": business_name,
        "customer_name": invoice.customer_name,
        "currency": invoice.currency,
        "status": invoice.status,
        "issue_date": invoice.issue_date,
        "due_date": invoice.due_date,
        "subtotal_minor": invoice.subtotal_minor,
        "vat_minor": invoice.vat_minor,
        "total_minor": invoice.total_minor,
        "line_items": invoice.line_items,
    }


# --- Expenses ----------------------------------------------------------------


@blp.route("/cases/<string:case_id>/expenses", methods=["POST"])
@jwt_required()
@blp.arguments(ExpenseSchema)
@blp.response(201, ExpenseSchema)
def create_expense_route(payload, case_id):
    case = _authed_case(case_id)
    expense = Expense(
        id=uuid.uuid4(),
        business_case_id=case.id,
        client_id=case.client_id,
        description=payload["description"],
        category=payload["category"],
        currency=payload.get("currency", "GHS"),
        amount_minor=payload["amount_minor"],
        expense_date=payload["expense_date"],
        note=payload.get("note"),
    )
    db.session.add(expense)
    db.session.commit()
    return expense


@blp.route("/cases/<string:case_id>/expenses", methods=["GET"])
@jwt_required()
@blp.response(200, ExpenseSchema(many=True))
def list_expenses_route(case_id):
    case = _authed_case(case_id)
    return Expense.query.filter_by(business_case_id=case.id).order_by(Expense.expense_date.desc()).all()


@blp.route("/expenses/<string:expense_id>/receipt-slot", methods=["POST"])
@jwt_required()
@blp.arguments(ReceiptSlotRequestSchema)
@blp.response(201, ReceiptSlotResponseSchema)
def expense_receipt_slot_route(payload, expense_id):
    if payload["size_bytes"] > current_app.config["MAX_UPLOAD_SIZE_BYTES"]:
        raise ValidationAppError("Receipt exceeds the 10 MB size limit.")
    try:
        expense = Expense.query.get(uuid.UUID(expense_id))
    except ValueError:
        raise NotFoundError("Expense not found") from None
    if expense is None:
        raise NotFoundError("Expense not found")
    ensure_case_access(get_current_user(), _case_or_404(expense.business_case_id))

    s3_key = f"cases/{expense.business_case_id}/expenses/{expense.id}/{payload['original_filename']}"
    expense.receipt_s3_key = s3_key
    db.session.commit()
    return {"upload_url": presign_put_url(s3_key, payload["content_type"]), "s3_key": s3_key}


# --- Reports -----------------------------------------------------------------


def _monthly_report(case_id, year: int) -> dict:
    """Cash-basis income (paid invoices) vs expenses per month, plus VAT
    collected. Grouped by currency to avoid nonsensical cross-currency sums."""
    invoices = ClientInvoice.query.filter(
        ClientInvoice.business_case_id == case_id,
        ClientInvoice.status == "paid",
        ClientInvoice.paid_at.isnot(None),
    ).all()
    expenses = Expense.query.filter(Expense.business_case_id == case_id).all()

    months = {
        m: {"month": m, "income_minor": 0, "expense_minor": 0, "vat_collected_minor": 0}
        for m in range(1, 13)
    }
    currencies: set[str] = set()
    for inv in invoices:
        if inv.paid_at.year != year:
            continue
        currencies.add(inv.currency)
        months[inv.paid_at.month]["income_minor"] += inv.subtotal_minor
        months[inv.paid_at.month]["vat_collected_minor"] += inv.vat_minor
    for exp in expenses:
        if exp.expense_date.year != year:
            continue
        currencies.add(exp.currency)
        months[exp.expense_date.month]["expense_minor"] += exp.amount_minor

    total_vat = sum(m["vat_collected_minor"] for m in months.values())
    return {
        "year": year,
        "currencies": sorted(currencies) or ["GHS"],
        "months": [months[m] for m in range(1, 13)],
        "total_income_minor": sum(m["income_minor"] for m in months.values()),
        "total_expense_minor": sum(m["expense_minor"] for m in months.values()),
        "total_vat_collected_minor": total_vat,
    }


@blp.route("/cases/<string:case_id>/report", methods=["GET"])
@jwt_required()
@blp.response(200)
def report_route(case_id):
    case = _authed_case(case_id)
    year = int(request.args.get("year", date.today().year))
    return _monthly_report(case.id, year)


@blp.route("/cases/<string:case_id>/export.csv", methods=["GET"])
@jwt_required()
def export_csv_route(case_id):
    case = _authed_case(case_id)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["type", "date", "number_or_category", "party", "currency", "amount", "vat"])

    for inv in ClientInvoice.query.filter_by(business_case_id=case.id).order_by(ClientInvoice.issue_date).all():
        writer.writerow(
            [
                "invoice",
                inv.issue_date.isoformat(),
                inv.invoice_number,
                inv.customer_name,
                inv.currency,
                f"{inv.total_minor / 100:.2f}",
                f"{inv.vat_minor / 100:.2f}",
            ]
        )
    for exp in Expense.query.filter_by(business_case_id=case.id).order_by(Expense.expense_date).all():
        writer.writerow(
            [
                "expense",
                exp.expense_date.isoformat(),
                exp.category,
                exp.description,
                exp.currency,
                f"-{exp.amount_minor / 100:.2f}",
                "",
            ]
        )

    return Response(
        buffer.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=bookkeeping.csv"},
    )

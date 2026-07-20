import secrets
import uuid
from datetime import date

from app.bookkeeping.models import ClientInvoice, ClientInvoiceLineItem
from app.extensions import db


def next_invoice_number(business_case_id) -> str:
    year = date.today().year
    count = ClientInvoice.query.filter(
        ClientInvoice.business_case_id == business_case_id,
        ClientInvoice.invoice_number.like(f"INV-{year}-%"),
    ).count()
    return f"INV-{year}-{count + 1:04d}"


def _line_amount(quantity_milli: int, unit_price_minor: int) -> int:
    # amount = qty * unit_price; qty stored *1000, so divide back.
    return round(quantity_milli * unit_price_minor / 1000)


def recompute_totals(invoice: ClientInvoice) -> None:
    subtotal = sum(li.amount_minor for li in invoice.line_items)
    vat = round(subtotal * invoice.vat_rate_bps / 10_000)
    invoice.subtotal_minor = subtotal
    invoice.vat_minor = vat
    invoice.total_minor = subtotal + vat


def set_line_items(invoice: ClientInvoice, items: list[dict]) -> None:
    invoice.line_items.clear()
    db.session.flush()
    for index, item in enumerate(items):
        quantity_milli = item.get("quantity_milli", 1000)
        unit_price = item["unit_price_minor"]
        invoice.line_items.append(
            ClientInvoiceLineItem(
                id=uuid.uuid4(),
                description=item["description"],
                quantity_milli=quantity_milli,
                unit_price_minor=unit_price,
                amount_minor=_line_amount(quantity_milli, unit_price),
                sequence_order=index,
            )
        )
    db.session.flush()
    recompute_totals(invoice)


def generate_share_token() -> str:
    return secrets.token_urlsafe(24)

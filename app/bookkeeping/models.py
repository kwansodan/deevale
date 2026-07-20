"""Light bookkeeping for clients' own businesses.

IMPORTANT: This is deliberately NOT a double-entry accounting engine. It records
client-issued invoices and expenses as flat rows for cash-basis summaries only.
There are no journals, no ledgers, no chart of accounts, and no balancing entries.
Tables are intentionally self-contained (money as integer minor units, currency
per row, no cross-row postings) so a real double-entry module could later be
layered on top, or replace this, without a data migration nightmare -- these rows
would become the "source documents" a proper ledger derives journal entries from.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.model_mixins import TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.extensions import db


class BusinessProfile(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    """The client's business identity as shown on invoices they issue."""

    __tablename__ = "business_profiles"

    business_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), unique=True, nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    default_currency: Mapped[str] = mapped_column(String(8), default="GHS", nullable=False)
    is_vat_registered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    vat_rate_bps: Mapped[int] = mapped_column(Integer, default=1500, nullable=False)  # 15.00% in basis points
    vat_number: Mapped[str | None] = mapped_column(String(64), nullable=True)


class ClientInvoice(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    """An invoice the client's business issues to *their* customer. Distinct
    from payments.Invoice (which is Deevale GH billing the client)."""

    __tablename__ = "client_invoices"

    business_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), nullable=False, index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(32), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="GHS", nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False)
    # draft | sent | paid | overdue
    issue_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    vat_rate_bps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    subtotal_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    vat_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    share_token: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    pdf_s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    line_items: Mapped[list["ClientInvoiceLineItem"]] = relationship(
        back_populates="invoice",
        order_by="ClientInvoiceLineItem.sequence_order",
        cascade="all, delete-orphan",
    )


class ClientInvoiceLineItem(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "client_invoice_line_items"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_invoices.id"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    quantity_milli: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)  # qty * 1000
    unit_price_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    sequence_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    invoice: Mapped["ClientInvoice"] = relationship(back_populates="line_items")


class Expense(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "expenses"

    business_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), nullable=False, index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    category: Mapped[str] = mapped_column(String(48), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="GHS", nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    receipt_s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

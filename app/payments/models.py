import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.model_mixins import TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.extensions import db


class Invoice(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "invoices"

    business_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), nullable=False
    )
    quote_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quotes.id"), nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False)
    subtotal_government_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    subtotal_service_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="GHS", nullable=False)
    receipt_s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    line_items: Mapped[list["InvoiceLineItem"]] = relationship(
        back_populates="invoice", order_by="InvoiceLineItem.sequence_order", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class InvoiceLineItem(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "invoice_line_items"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    fee_type: Mapped[str] = mapped_column(String(16), nullable=False)
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False)

    invoice: Mapped["Invoice"] = relationship(back_populates="line_items")


class Payment(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "payments"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="GHS", nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    is_manual_credit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")


class PaymentEvent(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "payment_events"
    __table_args__ = (UniqueConstraint("provider", "dedup_key", name="uq_payment_event_dedup"),)

    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    dedup_key: Mapped[str] = mapped_column(String(128), nullable=False)
    raw_payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

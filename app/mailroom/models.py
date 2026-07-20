import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.model_mixins import TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.extensions import db


class RegisteredAddressEnrollment(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    """A client's opt-in to use LaunchGH's office as their registered office.
    Consent + the disclaimer text they agreed to are captured immutably."""

    __tablename__ = "registered_address_enrollments"

    business_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), unique=True, nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    office_address: Mapped[str] = mapped_column(String(512), nullable=False)
    # Snapshot of the exact disclaimer wording the client consented to.
    consent_text: Mapped[str] = mapped_column(Text, nullable=False)
    consent_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False)  # active | cancelled


class MailItem(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    """One piece of physical mail received at the office for a client and
    scanned into their inbox."""

    __tablename__ = "mail_items"

    business_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), nullable=False, index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    logged_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    sender: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    received_date: Mapped[date] = mapped_column(Date, nullable=False)
    urgency: Mapped[str] = mapped_column(String(16), default="normal", nullable=False)  # normal | urgent
    # Multi-page scan (single PDF). Absent until scan-and-upload is confirmed.
    scan_s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    scan_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="logged", nullable=False)
    # logged (awaiting scan) | scanned (in client inbox) | shredded
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Retention: the scan is removed after this date (config MAIL_RETENTION_DAYS).
    shred_after: Mapped[date | None] = mapped_column(Date, nullable=True)
    shredded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MailForwardRequest(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    """Client asks for a physical mail item to be forwarded to them. Routed to
    the mail-room ops queue as a task."""

    __tablename__ = "mail_forward_requests"

    mail_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mail_items.id"), nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    forwarding_address: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="new", nullable=False)  # new | in_progress | done
    handled_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    is_forwarded_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

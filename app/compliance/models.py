import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.model_mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.extensions import db


class ComplianceObligation(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "compliance_obligations"

    business_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), nullable=False, index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    recurrence: Mapped[str] = mapped_column(String(16), nullable=False)  # annual|quarterly|monthly|one_off
    status: Mapped[str] = mapped_column(String(16), default="upcoming", nullable=False)
    # T-marks already reminded (e.g. [30, 14]) so the scanner never double-fires.
    reminded_marks: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)


class ServiceRequest(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    """'File it for me' mini-case: routed to the ops queue, worked by staff."""

    __tablename__ = "service_requests"

    obligation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("compliance_obligations.id"), nullable=False
    )
    business_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="new", nullable=False)  # new|in_progress|done
    assigned_officer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

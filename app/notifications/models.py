import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.model_mixins import UUIDPrimaryKeyMixin, utcnow
from app.extensions import db


class Notification(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    related_case_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), nullable=True
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    deliveries: Mapped[list["NotificationDelivery"]] = relationship(
        back_populates="notification", cascade="all, delete-orphan"
    )


class NotificationPreference(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "notification_preferences"
    __table_args__ = (UniqueConstraint("user_id", "category", name="uq_notification_pref_user_category"),)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    in_app_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # SMS/WhatsApp columns are nullable: NULL means "no explicit choice", so
    # the per-category routing default applies (see dispatcher.DEFAULT_MATRIX).
    sms_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    whatsapp_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)


class NotificationTemplate(db.Model, UUIDPrimaryKeyMixin):
    """Admin-editable override for the built-in notification copy in
    app/notifications/copy.py -- if a row exists for a category, its
    templates win over the code defaults."""

    __tablename__ = "notification_templates"

    category: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    title_template: Mapped[str] = mapped_column(String(255), nullable=False)
    body_template: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class NotificationDelivery(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "notification_deliveries"

    notification_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("notifications.id"), nullable=False
    )
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Per-message provider cost (pesewas) -- populated for SMS/WhatsApp sends.
    cost_minor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Channel-specific data, e.g. WhatsApp template variables.
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    notification: Mapped["Notification"] = relationship(back_populates="deliveries")

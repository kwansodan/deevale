import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.model_mixins import TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.extensions import db


class Partner(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    """A law/accounting firm reselling LaunchGH through the partner API."""

    __tablename__ = "partners"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # White-label accent applied via a CSS variable override on the partner console.
    accent_color: Mapped[str] = mapped_column(String(9), default="#14532D", nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False)
    # Per-partner API rate limit (requests/hour); enforced by Flask-Limiter.
    rate_limit_per_hour: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)

    api_keys: Mapped[list["PartnerApiKey"]] = relationship(back_populates="partner", cascade="all, delete-orphan")
    webhooks: Mapped[list["PartnerWebhook"]] = relationship(back_populates="partner", cascade="all, delete-orphan")


class PartnerApiKey(db.Model, UUIDPrimaryKeyMixin):
    """A scoped API key. Only the argon2 hash is stored -- the plaintext key is
    shown once at creation and never again."""

    __tablename__ = "partner_api_keys"

    partner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("partners.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    # Short public identifier embedded in the key so we can look it up without
    # hashing every stored key on each request.
    prefix: Mapped[str] = mapped_column(String(16), unique=True, nullable=False, index=True)
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    scopes: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    partner: Mapped["Partner"] = relationship(back_populates="api_keys")


class PartnerWebhook(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "partner_webhooks"

    partner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("partners.id"), nullable=False)
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    secret: Mapped[str] = mapped_column(String(128), nullable=False)  # for HMAC-signed payloads
    event_types: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    partner: Mapped["Partner"] = relationship(back_populates="webhooks")


class PartnerWebhookDelivery(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "partner_webhook_deliveries"

    webhook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("partner_webhooks.id"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(48), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    # pending | delivered | failed | abandoned
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    response_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

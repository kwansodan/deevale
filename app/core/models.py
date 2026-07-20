import uuid
from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.model_mixins import UUIDPrimaryKeyMixin, utcnow
from app.extensions import db


class AuditLog(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "audit_logs"

    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    context: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)


class PublicHoliday(db.Model, UUIDPrimaryKeyMixin):
    """Ghana public holidays -- admin-editable; feeds SLA business-day math."""

    __tablename__ = "public_holidays"

    holiday_date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)

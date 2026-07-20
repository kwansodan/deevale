import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.model_mixins import TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.extensions import db


class Subscription(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    plan: Mapped[str] = mapped_column(String(16), nullable=False)  # monthly | annual
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    # pending | active | past_due | cancelled
    provider: Mapped[str] = mapped_column(String(32), default="paystack", nullable=False)
    provider_reference: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


def has_active_subscription(user_id) -> bool:
    subscription = (
        Subscription.query.filter_by(user_id=user_id, status="active")
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if subscription is None:
        return False
    return subscription.current_period_end is None or subscription.current_period_end > utcnow()

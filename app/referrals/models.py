import secrets
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.model_mixins import TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.extensions import db


def _gen_code() -> str:
    return secrets.token_hex(4).upper()  # 8 hex chars, e.g. 3F9A2C11


class ReferralCode(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "referral_codes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )
    code: Mapped[str] = mapped_column(String(16), unique=True, default=_gen_code, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)


class Referral(db.Model, UUIDPrimaryKeyMixin):
    """Links a referred user to their referrer. `rewarded` flips once the
    referral reward has been granted, so payment.received can't double-pay."""

    __tablename__ = "referrals"

    referrer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    referred_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )
    rewarded: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)


class ReferralCredit(db.Model, UUIDPrimaryKeyMixin):
    """A single credit-ledger entry. Positive amounts are earned credit;
    applying a credit to an invoice flips status to 'applied'. This is a simple
    append-only ledger, not double-entry -- balance = sum of available."""

    __tablename__ = "referral_credits"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="GHS", nullable=False)
    source: Mapped[str] = mapped_column(String(24), nullable=False)  # referral | welcome | cofounder
    status: Mapped[str] = mapped_column(String(16), default="available", nullable=False)  # available | applied
    applied_invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)


class CoFounderInvite(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    """An invite for a co-owner/director to join a case and complete their own
    KYC on their own account."""

    __tablename__ = "cofounder_invites"
    __table_args__ = (UniqueConstraint("business_case_id", "invitee_email", name="uq_cofounder_case_email"),)

    business_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), nullable=False, index=True
    )
    inviter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    invitee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    invitee_email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(48), default="director", nullable=False)
    token: Mapped[str] = mapped_column(
        String(64), default=lambda: secrets.token_urlsafe(24), unique=True, index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)  # pending | accepted
    accepted_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    accepted_at: Mapped[datetime | None] = mapped_column(nullable=True)

import secrets
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.model_mixins import TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.extensions import db


class SignatureTemplate(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    """A reusable document with Jinja-style merge fields (e.g. {{ party_name }},
    {{ shares }}). Staff instantiate a signing request from one."""

    __tablename__ = "signature_templates"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    body_html: Mapped[str] = mapped_column(Text, nullable=False)
    # Field names the template expects, for the ops form (informational).
    merge_fields: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)


class SignatureRequest(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "signature_requests"

    business_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), nullable=False, index=True
    )
    case_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("case_tasks.id"), nullable=True
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("signature_templates.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), default="builtin", nullable=False)
    provider_reference: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False)
    # draft | sent | completed | declined
    merged_html: Mapped[str] = mapped_column(Text, nullable=False)
    signed_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True
    )
    signed_pdf_s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    parties: Mapped[list["SignatureParty"]] = relationship(
        back_populates="request",
        order_by="SignatureParty.order_index",
        cascade="all, delete-orphan",
    )


class SignatureParty(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "signature_parties"

    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("signature_requests.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    # pending | signed | declined
    sign_token: Mapped[str] = mapped_column(
        String(64), default=lambda: secrets.token_urlsafe(24), unique=True, index=True, nullable=False
    )
    # For the built-in fallback: "drawn" (canvas image) or "typed"; "provider"
    # when signed through an external e-signature provider.
    signature_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    signature_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # data URL or typed name
    signed_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    request: Mapped["SignatureRequest"] = relationship(back_populates="parties")

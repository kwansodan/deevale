import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.model_mixins import TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.extensions import db


class Document(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "documents"

    business_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), nullable=False
    )
    case_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("case_tasks.id"), nullable=True
    )
    document_type_code: Mapped[str] = mapped_column(String(64), nullable=False)
    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    is_vault: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    current_version_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    versions: Mapped[list["DocumentVersion"]] = relationship(
        back_populates="document",
        order_by="DocumentVersion.version_number",
        cascade="all, delete-orphan",
        foreign_keys="DocumentVersion.document_id",
    )

    def current_version(self) -> "DocumentVersion | None":
        for v in sorted(self.versions, key=lambda x: x.version_number, reverse=True):
            return v
        return None


class DocumentVersion(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "document_versions"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    s3_key: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    upload_status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    review_status: Mapped[str] = mapped_column(String(16), default="pending_review", nullable=False)
    review_reason_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    virus_scan_status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    document: Mapped["Document"] = relationship(back_populates="versions", foreign_keys=[document_id])

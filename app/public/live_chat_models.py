import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.model_mixins import TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.extensions import db


class LiveChatSession(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "live_chat_sessions"

    visitor_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    visitor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    visitor_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    visitor_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    current_page: Mapped[str] = mapped_column(String(255), default="/", nullable=False)
    referrer: Mapped[str | None] = mapped_column(String(512), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(256), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False)
    # active | closed
    is_online: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    assigned_officer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    assigned_officer = relationship("app.auth.models.User", foreign_keys=[assigned_officer_id])
    messages: Mapped[list["LiveChatMessage"]] = relationship(
        "LiveChatMessage",
        back_populates="session",
        order_by="LiveChatMessage.created_at",
        cascade="all, delete-orphan",
    )

    def to_dict(self, include_messages: bool = False) -> dict:
        data = {
            "id": str(self.id),
            "visitor_id": self.visitor_id,
            "visitor_name": self.visitor_name,
            "visitor_email": self.visitor_email,
            "visitor_phone": self.visitor_phone,
            "current_page": self.current_page,
            "referrer": self.referrer,
            "user_agent": self.user_agent,
            "ip_address": self.ip_address,
            "status": self.status,
            "is_online": self.is_online,
            "last_seen_at": self.last_seen_at.isoformat() if self.last_seen_at else None,
            "assigned_officer_id": str(self.assigned_officer_id) if self.assigned_officer_id else None,
            "assigned_officer_name": self.assigned_officer.full_name if self.assigned_officer else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "unread_count": sum(1 for m in self.messages if m.sender_type == "visitor" and m.read_at is None),
            "last_message": self.messages[-1].to_dict() if self.messages else None,
        }
        if include_messages:
            data["messages"] = [m.to_dict() for m in self.messages]
        return data


class LiveChatMessage(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "live_chat_messages"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("live_chat_sessions.id"), nullable=False, index=True
    )
    sender_type: Mapped[str] = mapped_column(String(16), nullable=False)
    # visitor | staff | system
    sender_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    sender_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    session: Mapped[LiveChatSession] = relationship("LiveChatSession", back_populates="messages")
    sender_user = relationship("app.auth.models.User", foreign_keys=[sender_user_id])

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "session_id": str(self.session_id),
            "sender_type": self.sender_type,
            "sender_user_id": str(self.sender_user_id) if self.sender_user_id else None,
            "sender_name": self.sender_name or (self.sender_user.full_name if self.sender_user else "Visitor"),
            "body": self.body,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

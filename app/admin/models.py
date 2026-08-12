import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.model_mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.extensions import db


class PlatformSetting(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    """Runtime-editable platform configuration, keyed by a short string.

    Deliberately a thin key/JSON store rather than a column per setting: the
    values here (referral reward amounts, the public landing-page figures) are
    things a platform admin changes without a deploy, and each `key` owns an
    opaque JSON blob whose shape is defined by its reader in settings_service.
    Missing keys fall back to app.config / env, so this table is purely an
    override layer.
    """

    __tablename__ = "platform_settings"

    key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

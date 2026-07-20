import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.model_mixins import TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.extensions import db

# --- Templates -------------------------------------------------------------


class WorkflowDefinition(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "workflow_definitions"

    entity_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # One entity type can have several tracks -- "standard" for wholly local
    # ownership, "foreign" for the GIPC/GIPA foreign-participation route.
    variant: Mapped[str] = mapped_column(String(32), default="standard", nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    stage_definitions: Mapped[list["StageDefinition"]] = relationship(
        back_populates="workflow_definition",
        order_by="StageDefinition.sequence_order",
        cascade="all, delete-orphan",
    )


class StageDefinition(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "stage_definitions"

    workflow_definition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_definitions.id"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_gated_by_payment: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deadline_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Internal processing SLA for this stage's tasks, in hours; converted to
    # business days (Ghana holidays excluded) when the stage starts.
    sla_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)

    workflow_definition: Mapped["WorkflowDefinition"] = relationship(back_populates="stage_definitions")
    task_definitions: Mapped[list["TaskDefinition"]] = relationship(
        back_populates="stage_definition",
        order_by="TaskDefinition.sequence_order",
        cascade="all, delete-orphan",
    )


class TaskDefinition(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "task_definitions"

    stage_definition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stage_definitions.id"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False)
    assignee_type: Mapped[str] = mapped_column(String(16), nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    requires_document: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    required_document_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    allowed_transition_roles: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    stage_definition: Mapped["StageDefinition"] = relationship(back_populates="task_definitions")


# --- Instances ---------------------------------------------------------------


class BusinessCase(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "business_cases"

    case_number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_officer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    workflow_definition_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_definitions.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    onboarding_payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    current_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("case_stages.id", use_alter=True), nullable=True
    )
    # Set when a partner (law/accounting firm) created the case via the partner API.
    partner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("partners.id"), nullable=True, index=True
    )

    stages: Mapped[list["CaseStage"]] = relationship(
        back_populates="business_case",
        order_by="CaseStage.sequence_order",
        cascade="all, delete-orphan",
        foreign_keys="CaseStage.business_case_id",
    )
    quote: Mapped["Quote | None"] = relationship(back_populates="business_case", uselist=False, cascade="all, delete-orphan")


class CaseStage(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "case_stages"

    business_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), nullable=False
    )
    stage_definition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stage_definitions.id"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="locked")
    is_gated_by_payment: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    business_case: Mapped["BusinessCase"] = relationship(
        back_populates="stages", foreign_keys=[business_case_id]
    )
    tasks: Mapped[list["CaseTask"]] = relationship(
        back_populates="case_stage", order_by="CaseTask.sequence_order", cascade="all, delete-orphan"
    )
    stage_definition: Mapped["StageDefinition"] = relationship()


class CaseTask(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "case_tasks"

    case_stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("case_stages.id"), nullable=False
    )
    task_definition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("task_definitions.id"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    assignee_type: Mapped[str] = mapped_column(String(16), nullable=False)
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    requires_document: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    required_document_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    allowed_transition_roles: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    linked_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", use_alter=True), nullable=True
    )
    government_reference_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sla_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sla_breached_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    escalated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    case_stage: Mapped["CaseStage"] = relationship(back_populates="tasks")
    task_definition: Mapped["TaskDefinition"] = relationship()


# --- Fee schedule & quotes ---------------------------------------------------


class FeeScheduleItem(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "fee_schedule_items"

    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    applies_to_entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    applies_to_stage_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="GHS", nullable=False)
    fee_type: Mapped[str] = mapped_column(String(16), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Quote(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "quotes"

    business_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_cases.id"), unique=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False)
    subtotal_government_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    subtotal_service_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="GHS", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    business_case: Mapped["BusinessCase"] = relationship(back_populates="quote")
    line_items: Mapped[list["QuoteLineItem"]] = relationship(
        back_populates="quote", order_by="QuoteLineItem.sequence_order", cascade="all, delete-orphan"
    )


class QuoteLineItem(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "quote_line_items"

    quote_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quotes.id"), nullable=False)
    fee_schedule_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fee_schedule_items.id"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    fee_type: Mapped[str] = mapped_column(String(16), nullable=False)
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False)

    quote: Mapped["Quote"] = relationship(back_populates="line_items")


class OnboardingDraft(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    """Save-and-resume state for the onboarding wizard: one draft per user,
    upserted on every step change, deleted once the case is created."""

    __tablename__ = "onboarding_drafts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    current_step: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

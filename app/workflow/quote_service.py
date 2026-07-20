import uuid

from app.core.model_mixins import utcnow
from app.extensions import db
from app.workflow.enums import FeeType, QuoteStatus
from app.workflow.models import BusinessCase, FeeScheduleItem, Quote, QuoteLineItem


def applicable_fee_items(entity_type: str, stage_codes: list[str] | None = None) -> list[FeeScheduleItem]:
    """The single source of truth for which fee schedule rows apply right
    now -- used both for the pre-case quote preview shown in the onboarding
    wizard and for the persisted quote at case creation, so the number a
    client sees before paying is always the number they're quoted.

    A government fee tied to a stage (applies_to_stage_code) is only charged
    when that stage is actually part of the case's workflow -- this is what
    keeps GIPC fees off wholly-local quotes without any special-casing.
    """
    now = utcnow()
    items = (
        FeeScheduleItem.query.filter(FeeScheduleItem.is_active.is_(True))
        .filter(FeeScheduleItem.effective_from <= now)
        .filter((FeeScheduleItem.effective_to.is_(None)) | (FeeScheduleItem.effective_to >= now))
        .filter(
            (FeeScheduleItem.applies_to_entity_type.is_(None))
            | (FeeScheduleItem.applies_to_entity_type == entity_type)
        )
        .order_by(FeeScheduleItem.fee_type, FeeScheduleItem.code)
        .all()
    )
    if stage_codes is not None:
        stage_set = set(stage_codes)
        items = [i for i in items if i.applies_to_stage_code is None or i.applies_to_stage_code in stage_set]
    return items


def _workflow_stage_codes(entity_type: str, variant: str) -> list[str]:
    from app.workflow.models import WorkflowDefinition

    workflow = (
        WorkflowDefinition.query.filter_by(entity_type=entity_type, variant=variant, is_active=True)
        .order_by(WorkflowDefinition.version.desc())
        .first()
    )
    if workflow is None and variant == "foreign":
        return _workflow_stage_codes(entity_type, "standard")
    if workflow is None:
        return []
    return [s.code for s in workflow.stage_definitions]


def preview_quote(entity_type: str, foreign_participation: bool = False) -> dict:
    """Itemized quote computed from the fee schedule without creating any
    rows -- powers the wizard's Quote step."""
    variant = "foreign" if foreign_participation else "standard"
    stage_codes = _workflow_stage_codes(entity_type, variant)
    items = applicable_fee_items(entity_type, stage_codes if stage_codes else None)
    subtotal_government = sum(i.amount_minor for i in items if i.fee_type == FeeType.GOVERNMENT.value)
    subtotal_service = sum(i.amount_minor for i in items if i.fee_type != FeeType.GOVERNMENT.value)
    return {
        "line_items": [
            {"label": i.label, "amount_minor": i.amount_minor, "fee_type": i.fee_type} for i in items
        ],
        "subtotal_government_minor": subtotal_government,
        "subtotal_service_minor": subtotal_service,
        "total_minor": subtotal_government + subtotal_service,
        "currency": "GHS",
    }


def compute_quote(case: BusinessCase) -> Quote:
    """Builds an itemized quote purely from the FeeScheduleItem table --
    government fees are never hardcoded in application code. Labels and
    amounts are snapshotted onto the QuoteLineItem so a historical quote
    stays stable even if the fee schedule changes later.
    """
    items = applicable_fee_items(case.entity_type, [s.code for s in case.stages])

    quote = Quote(
        id=uuid.uuid4(),
        business_case_id=case.id,
        status=QuoteStatus.FINALIZED.value,
        currency="GHS",
    )
    db.session.add(quote)
    db.session.flush()

    subtotal_government = 0
    subtotal_service = 0
    for index, item in enumerate(items):
        db.session.add(
            QuoteLineItem(
                id=uuid.uuid4(),
                quote_id=quote.id,
                fee_schedule_item_id=item.id,
                label=item.label,
                amount_minor=item.amount_minor,
                fee_type=item.fee_type,
                sequence_order=index,
            )
        )
        if item.fee_type == FeeType.GOVERNMENT.value:
            subtotal_government += item.amount_minor
        else:
            subtotal_service += item.amount_minor

    quote.subtotal_government_minor = subtotal_government
    quote.subtotal_service_minor = subtotal_service
    quote.total_minor = subtotal_government + subtotal_service
    db.session.flush()
    return quote

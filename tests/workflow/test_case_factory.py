import pytest

from app.core.errors import ValidationAppError
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import make_user


def test_create_case_clones_stages_and_tasks_and_starts_first_stage(app):
    with app.app_context():
        seed_company_ltd_workflow()
        client = make_user(email="factoryclient@example.com")

        case = CaseFactory.create_from_onboarding(
            client, {"entity_type": "company_limited_by_shares", "planned_employees": 0}
        )

        assert case.case_number.startswith("LGH-")
        assert len(case.stages) == 6

        first_stage = min(case.stages, key=lambda s: s.sequence_order)
        assert first_stage.status == "in_progress"
        assert first_stage.code == "name_reservation"
        assert len(first_stage.tasks) == 3

        other_stages = [s for s in case.stages if s.id != first_stage.id]
        assert all(s.status == "locked" for s in other_stages)


def test_create_case_computes_quote_from_fee_schedule(app):
    with app.app_context():
        from app.workflow.enums import FeeType
        from app.workflow.models import FeeScheduleItem

        seed_company_ltd_workflow()
        FeeScheduleItem.query.delete()
        from app.extensions import db

        db.session.add_all(
            [
                FeeScheduleItem(
                    code="TEST_GOV_FEE",
                    label="Test Government Fee",
                    amount_minor=10_000,
                    fee_type=FeeType.GOVERNMENT.value,
                ),
                FeeScheduleItem(
                    code="TEST_SERVICE_FEE",
                    label="Test Service Fee",
                    applies_to_entity_type="company_limited_by_shares",
                    amount_minor=50_000,
                    fee_type=FeeType.SERVICE.value,
                ),
            ]
        )
        db.session.commit()

        client = make_user(email="quoteclient@example.com")
        case = CaseFactory.create_from_onboarding(client, {"entity_type": "company_limited_by_shares"})

        assert case.quote is not None
        assert case.quote.subtotal_government_minor == 10_000
        assert case.quote.subtotal_service_minor == 50_000
        assert case.quote.total_minor == 60_000
        assert len(case.quote.line_items) == 2


def test_unsupported_entity_type_rejected(app):
    with app.app_context():
        seed_company_ltd_workflow()
        client = make_user(email="unsupported@example.com")
        with pytest.raises(ValidationAppError):
            CaseFactory.create_from_onboarding(client, {"entity_type": "sole_proprietorship"})

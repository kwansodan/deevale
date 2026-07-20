from datetime import timedelta
from unittest.mock import patch

from app.core.model_mixins import utcnow
from app.deadlines.scanner import scan_upcoming_deadlines
from app.workflow.case_factory import CaseFactory
from app.workflow.enums import StageStatus
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import make_user


def _case_with_stage1(app, email):
    seed_company_ltd_workflow()
    client = make_user(email=email)
    case = CaseFactory.create_from_onboarding(client, {"entity_type": "company_limited_by_shares"})
    stage1 = min(case.stages, key=lambda s: s.sequence_order)
    assert stage1.status == StageStatus.IN_PROGRESS.value
    return case, stage1


def test_scanner_emits_deadline_approaching_within_t14_window(app):
    with app.app_context():
        case, stage1 = _case_with_stage1(app, "deadline1@example.com")
        stage1.deadline_at = utcnow() + timedelta(days=14)
        from app.extensions import db

        db.session.commit()

        with patch("app.deadlines.scanner.bus") as mock_bus:
            emitted = scan_upcoming_deadlines()

        assert emitted == 1
        assert mock_bus.dispatch.call_count == 1
        event = mock_bus.dispatch.call_args[0][0]
        assert event.days_remaining == 14
        assert event.case_id == case.id


def test_scanner_ignores_stage_far_from_deadline(app):
    with app.app_context():
        _, stage1 = _case_with_stage1(app, "deadline2@example.com")
        stage1.deadline_at = utcnow() + timedelta(days=25)
        from app.extensions import db

        db.session.commit()

        with patch("app.deadlines.scanner.bus") as mock_bus:
            emitted = scan_upcoming_deadlines()

        assert emitted == 0
        mock_bus.dispatch.assert_not_called()


def test_scanner_ignores_stages_without_a_deadline(app):
    with app.app_context():
        _, stage1 = _case_with_stage1(app, "deadline3@example.com")
        assert stage1.deadline_at is not None  # name_reservation has a 30-day deadline by default

        from app.extensions import db

        stage1.deadline_at = None
        db.session.commit()

        with patch("app.deadlines.scanner.bus") as mock_bus:
            emitted = scan_upcoming_deadlines()

        assert emitted == 0
        mock_bus.dispatch.assert_not_called()


def test_scanner_ignores_completed_stages(app):
    with app.app_context():
        _, stage1 = _case_with_stage1(app, "deadline4@example.com")
        from app.extensions import db

        stage1.deadline_at = utcnow() + timedelta(days=2)
        stage1.status = StageStatus.COMPLETED.value
        db.session.commit()

        with patch("app.deadlines.scanner.bus") as mock_bus:
            emitted = scan_upcoming_deadlines()

        assert emitted == 0
        mock_bus.dispatch.assert_not_called()

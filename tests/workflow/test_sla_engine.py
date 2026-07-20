from datetime import UTC, date, datetime, timedelta

from freezegun import freeze_time

from app.core.business_days import add_business_days, sla_hours_to_business_days
from app.core.enums import RoleName
from app.core.models import PublicHoliday
from app.deadlines.sla_scanner import scan_sla_breaches
from app.extensions import db
from app.notifications.models import Notification
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import make_user

# --- Business-day math -------------------------------------------------------


def test_business_days_skip_weekends():
    # Friday 2026-07-17 + 2 business days -> Tuesday 2026-07-21.
    start = datetime(2026, 7, 17, 10, 0, tzinfo=UTC)
    result = add_business_days(start, 2, holidays=set())
    assert result.date() == date(2026, 7, 21)
    assert result.hour == 10  # time of day preserved


def test_business_days_skip_a_public_holiday():
    # Wednesday 2026-07-01 is Ghana's Republic Day. Tuesday 2026-06-30 +
    # 2 business days would land Thursday 2026-07-02 without the holiday;
    # with it, Friday 2026-07-03.
    start = datetime(2026, 6, 30, 9, 0, tzinfo=UTC)
    without_holiday = add_business_days(start, 2, holidays=set())
    with_holiday = add_business_days(start, 2, holidays={date(2026, 7, 1)})
    assert without_holiday.date() == date(2026, 7, 2)
    assert with_holiday.date() == date(2026, 7, 3)


def test_business_days_start_on_weekend_rolls_forward():
    # Saturday start + 1 business day: roll to Monday, then -> Tuesday.
    start = datetime(2026, 7, 18, 12, 0, tzinfo=UTC)
    result = add_business_days(start, 1, holidays=set())
    assert result.date() == date(2026, 7, 21)


def test_sla_hours_round_up_to_days():
    assert sla_hours_to_business_days(72) == 3
    assert sla_hours_to_business_days(80) == 4
    assert sla_hours_to_business_days(1) == 1


# --- SLA timers on stage start -------------------------------------------------


def test_stage_start_sets_sla_due_dates_respecting_holidays(app):
    with app.app_context():
        # Tuesday 2026-07-14; name_reservation SLA is 72h = 3 business days.
        # Wednesday 2026-07-15 is seeded as a holiday, pushing due to Monday 20th.
        db.session.add(PublicHoliday(holiday_date=date(2026, 7, 15), name="Test Holiday"))
        db.session.commit()
        seed_company_ltd_workflow()
        client_user = make_user(email="slatimer@example.com")

        with freeze_time(datetime(2026, 7, 14, 9, 0, tzinfo=UTC)):
            case = CaseFactory.create_from_onboarding(
                client_user, {"entity_type": "company_limited_by_shares"}
            )

        stage1 = min(case.stages, key=lambda s: s.sequence_order)
        for task in stage1.tasks:
            assert task.sla_due_at is not None
            assert task.sla_due_at.date() == date(2026, 7, 20)


# --- Breach detection and escalation ---------------------------------------------


def _case_with_officer(email_prefix):
    seed_company_ltd_workflow()
    supervisor = make_user(email=f"{email_prefix}-supervisor@example.com", roles=[RoleName.CASE_OFFICER])
    officer = make_user(email=f"{email_prefix}-officer@example.com", roles=[RoleName.CASE_OFFICER])
    officer.supervisor_id = supervisor.id
    client_user = make_user(email=f"{email_prefix}-client@example.com")
    case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
    case.assigned_officer_id = officer.id
    db.session.commit()
    return supervisor, officer, case


def test_breach_flags_task_and_alerts_officer_then_escalates_to_supervisor(app):
    with app.app_context():
        start = datetime(2026, 7, 14, 9, 0, tzinfo=UTC)
        with freeze_time(start):
            supervisor, officer, case = _case_with_officer("chain")

        stage1 = min(case.stages, key=lambda s: s.sequence_order)
        first_due = min(t.sla_due_at for t in stage1.tasks)

        # 1h past due: breach flagged, officer alerted, no escalation yet.
        with freeze_time(first_due + timedelta(hours=1)):
            result = scan_sla_breaches.run()
        assert result["breached"] >= 1
        assert result["escalated"] == 0
        db.session.expire_all()
        assert any(t.sla_breached_at is not None for t in stage1.tasks)
        officer_alerts = Notification.query.filter_by(
            user_id=officer.id, category="staff_sla_breach"
        ).count()
        assert officer_alerts >= 1
        assert Notification.query.filter_by(user_id=supervisor.id).count() == 0

        # Re-running immediately must not duplicate breach alerts.
        with freeze_time(first_due + timedelta(hours=2)):
            rerun = scan_sla_breaches.run()
        assert rerun["breached"] == 0

        # 25h after breach: escalated to the supervisor exactly once.
        with freeze_time(first_due + timedelta(hours=1) + timedelta(hours=25)):
            escalation_run = scan_sla_breaches.run()
        assert escalation_run["escalated"] >= 1
        supervisor_alerts = Notification.query.filter_by(
            user_id=supervisor.id, category="staff_sla_breach"
        ).all()
        assert len(supervisor_alerts) >= 1
        assert "ESCALATION" in supervisor_alerts[0].body

        with freeze_time(first_due + timedelta(hours=28)):
            assert scan_sla_breaches.run()["escalated"] == 0  # idempotent


def test_completed_tasks_never_breach(app):
    with app.app_context():
        start = datetime(2026, 7, 14, 9, 0, tzinfo=UTC)
        with freeze_time(start):
            _, _, case = _case_with_officer("done")

        stage1 = min(case.stages, key=lambda s: s.sequence_order)
        for task in stage1.tasks:
            task.status = "done"
        db.session.commit()

        with freeze_time(start + timedelta(days=30)):
            result = scan_sla_breaches.run()
        db.session.expire_all()
        assert all(t.sla_breached_at is None for t in stage1.tasks)
        assert result["breached"] == 0

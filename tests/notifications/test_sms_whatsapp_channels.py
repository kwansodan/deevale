from datetime import UTC, datetime

from freezegun import freeze_time

from app.core.enums import RoleName
from app.core.events.bus import bus
from app.core.events.events import CaseBlocked, TaskAwaitingClient
from app.extensions import db
from app.notifications.models import Notification, NotificationDelivery, NotificationPreference
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import make_user

DAYTIME = datetime(2026, 7, 15, 10, 0, tzinfo=UTC)  # 10:00 Ghana time
NIGHTTIME = datetime(2026, 7, 15, 22, 0, tzinfo=UTC)  # 22:00 -- quiet hours


def _case(email):
    seed_company_ltd_workflow()
    client_user = make_user(email=email, roles=[RoleName.CLIENT])
    case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
    return client_user, case


def _channels_for(user_id, category):
    notification = Notification.query.filter_by(user_id=user_id, category=category).one()
    deliveries = NotificationDelivery.query.filter_by(notification_id=notification.id).all()
    return {d.channel for d in deliveries}, deliveries


@freeze_time(DAYTIME)
def test_action_required_defaults_to_in_app_email_sms(app):
    with app.app_context():
        client_user, case = _case("route1@example.com")
        stage1 = min(case.stages, key=lambda s: s.sequence_order)
        task = next(t for t in stage1.tasks if t.assignee_type == "client")

        bus.dispatch(TaskAwaitingClient(case_id=case.id, task_id=task.id))

        channels, deliveries = _channels_for(client_user.id, "action_required")
        assert channels == {"in_app", "email", "sms"}
        sms = next(d for d in deliveries if d.channel == "sms")
        assert sms.status == "sent"  # eager celery in tests; console sender
        assert sms.cost_minor == app.config["SMS_DEFAULT_COST_MINOR"]  # per-message cost logged


@freeze_time(DAYTIME)
def test_other_categories_default_to_in_app_email_only(app):
    with app.app_context():
        client_user, case = _case("route2@example.com")
        bus.dispatch(CaseBlocked(case_id=case.id, reason="Test"))

        channels, _ = _channels_for(client_user.id, "case_blocked")
        assert channels == {"in_app", "email"}


@freeze_time(DAYTIME)
def test_whatsapp_is_opt_in_and_renders_template_variables(app):
    with app.app_context():
        client_user, case = _case("route3@example.com")
        db.session.add(
            NotificationPreference(
                user_id=client_user.id,
                category="action_required",
                email_enabled=True,
                in_app_enabled=True,
                whatsapp_enabled=True,
            )
        )
        db.session.commit()

        stage1 = min(case.stages, key=lambda s: s.sequence_order)
        task = next(t for t in stage1.tasks if t.assignee_type == "client")
        bus.dispatch(TaskAwaitingClient(case_id=case.id, task_id=task.id))

        channels, deliveries = _channels_for(client_user.id, "action_required")
        assert "whatsapp" in channels
        wa = next(d for d in deliveries if d.channel == "whatsapp")
        assert wa.payload["template_name"] == "lgh_action_required"
        # Variables render from context in template order: business_name, task_name.
        assert wa.payload["variables"][1] == task.name
        assert wa.status == "sent"


@freeze_time(DAYTIME)
def test_user_can_disable_default_sms(app):
    with app.app_context():
        client_user, case = _case("route4@example.com")
        db.session.add(
            NotificationPreference(
                user_id=client_user.id,
                category="action_required",
                email_enabled=True,
                in_app_enabled=True,
                sms_enabled=False,
            )
        )
        db.session.commit()

        stage1 = min(case.stages, key=lambda s: s.sequence_order)
        task = next(t for t in stage1.tasks if t.assignee_type == "client")
        bus.dispatch(TaskAwaitingClient(case_id=case.id, task_id=task.id))

        channels, _ = _channels_for(client_user.id, "action_required")
        assert "sms" not in channels


@freeze_time(NIGHTTIME)
def test_sms_during_quiet_hours_is_queued_until_seven_am(app):
    with app.app_context():
        client_user, case = _case("route5@example.com")
        stage1 = min(case.stages, key=lambda s: s.sequence_order)
        task = next(t for t in stage1.tasks if t.assignee_type == "client")

        bus.dispatch(TaskAwaitingClient(case_id=case.id, task_id=task.id))

        _, deliveries = _channels_for(client_user.id, "action_required")
        sms = next(d for d in deliveries if d.channel == "sms")
        assert sms.status == "queued"
        assert sms.next_retry_at.hour == 7
        assert sms.next_retry_at.date() == datetime(2026, 7, 16, tzinfo=UTC).date()  # next morning
        assert sms.sent_at is None


def test_flush_queued_sms_sends_after_quiet_hours(app):
    with app.app_context():
        from app.notifications.tasks import flush_queued_sms

        with freeze_time(NIGHTTIME):
            client_user, case = _case("route6@example.com")
            stage1 = min(case.stages, key=lambda s: s.sequence_order)
            task = next(t for t in stage1.tasks if t.assignee_type == "client")
            bus.dispatch(TaskAwaitingClient(case_id=case.id, task_id=task.id))

            # Still night: flush is a no-op.
            assert flush_queued_sms.run() == 0

        with freeze_time(datetime(2026, 7, 16, 8, 0, tzinfo=UTC)):
            flushed = flush_queued_sms.run()
            assert flushed == 1
            _, deliveries = _channels_for(client_user.id, "action_required")
            sms = next(d for d in deliveries if d.channel == "sms")
            assert sms.status == "sent"

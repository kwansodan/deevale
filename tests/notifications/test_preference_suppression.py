from app.core.enums import RoleName
from app.core.events.bus import bus
from app.core.events.events import TaskAwaitingClient
from app.notifications.models import Notification, NotificationDelivery
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def _case(email):
    seed_company_ltd_workflow()
    client_user = make_user(email=email, roles=[RoleName.CLIENT])
    case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
    return client_user, case


def test_email_disabled_preference_suppresses_email_channel_only(app, client):
    with app.app_context():
        client_user, case = _case("notifypref1@example.com")

        put_resp = client.put(
            "/notifications/preferences",
            headers=auth_headers(client_user),
            json={"preferences": [{"category": "action_required", "email_enabled": False, "in_app_enabled": True}]},
        )
        assert put_resp.status_code == 200
        updated = next(p for p in put_resp.get_json() if p["category"] == "action_required")
        assert updated["email_enabled"] is False

        stage1 = min(case.stages, key=lambda s: s.sequence_order)
        task = next(t for t in stage1.tasks if t.assignee_type == "client")
        bus.dispatch(TaskAwaitingClient(case_id=case.id, task_id=task.id))

        notification = Notification.query.filter_by(user_id=client_user.id, category="action_required").one()
        deliveries = NotificationDelivery.query.filter_by(notification_id=notification.id).all()
        channels = {d.channel for d in deliveries}
        assert channels == {"in_app"}  # email suppressed


def test_both_channels_disabled_suppresses_all_deliveries(app):
    with app.app_context():
        client_user, case = _case("notifypref2@example.com")

        from app.extensions import db
        from app.notifications.models import NotificationPreference

        db.session.add(
            NotificationPreference(
                user_id=client_user.id, category="action_required", email_enabled=False, in_app_enabled=False
            )
        )
        db.session.commit()

        from app.core.events.bus import bus
        from app.core.events.events import TaskAwaitingClient

        stage1 = min(case.stages, key=lambda s: s.sequence_order)
        task = next(t for t in stage1.tasks if t.assignee_type == "client")
        bus.dispatch(TaskAwaitingClient(case_id=case.id, task_id=task.id))

        notification = Notification.query.filter_by(user_id=client_user.id, category="action_required").one()
        deliveries = NotificationDelivery.query.filter_by(notification_id=notification.id).all()
        assert deliveries == []


def test_default_preference_is_both_channels_enabled(app, client):
    with app.app_context():
        client_user, _case_obj = _case("notifypref3@example.com")

        resp = client.get("/notifications/preferences", headers=auth_headers(client_user))
        assert resp.status_code == 200
        prefs = resp.get_json()
        assert len(prefs) > 0
        assert all(p["email_enabled"] is True and p["in_app_enabled"] is True for p in prefs)

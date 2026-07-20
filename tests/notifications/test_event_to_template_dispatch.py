from app.core.enums import RoleName
from app.core.events.bus import bus
from app.core.events.events import CaseBlocked, DeadlineApproaching, DocumentRejected, TaskAwaitingClient
from app.notifications.models import Notification, NotificationDelivery
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import make_user


def _case(email):
    seed_company_ltd_workflow()
    client_user = make_user(email=email, roles=[RoleName.CLIENT])
    case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
    return client_user, case


def test_task_awaiting_client_dispatches_action_required_notification(app):
    with app.app_context():
        client_user, case = _case("notifydispatch1@example.com")
        stage1 = min(case.stages, key=lambda s: s.sequence_order)
        task = next(t for t in stage1.tasks if t.assignee_type == "client")

        bus.dispatch(TaskAwaitingClient(case_id=case.id, task_id=task.id))

        notification = Notification.query.filter_by(user_id=client_user.id, category="action_required").one()
        assert task.name in notification.body
        assert notification.related_case_id == case.id

        deliveries = NotificationDelivery.query.filter_by(notification_id=notification.id).all()
        channels = {d.channel for d in deliveries}
        assert channels == {"in_app", "email"}
        in_app_delivery = next(d for d in deliveries if d.channel == "in_app")
        assert in_app_delivery.status == "sent"


def test_document_rejected_dispatches_notification_with_reason(app):
    with app.app_context():
        client_user, case = _case("notifydispatch2@example.com")
        stage1 = min(case.stages, key=lambda s: s.sequence_order)
        task = next(t for t in stage1.tasks if t.code == "orc_name_reservation_filed")

        import uuid

        bus.dispatch(
            DocumentRejected(
                case_id=case.id,
                document_id=uuid.uuid4(),
                reason_code="illegible",
                note="Please rescan.",
                task_id=task.id,
            )
        )

        notification = Notification.query.filter_by(user_id=client_user.id, category="document_rejected").one()
        assert "illegible" in notification.body
        assert "Please rescan." in notification.body


def test_deadline_approaching_dispatches_countdown_notification(app):
    with app.app_context():
        client_user, case = _case("notifydispatch3@example.com")
        stage1 = min(case.stages, key=lambda s: s.sequence_order)

        bus.dispatch(
            DeadlineApproaching(case_id=case.id, entity_type="case_stage", entity_id=stage1.id, days_remaining=7)
        )

        notification = Notification.query.filter_by(
            user_id=client_user.id, category="deadline_countdown"
        ).one()
        assert "7" in notification.body


def test_case_blocked_dispatches_notification(app):
    with app.app_context():
        client_user, case = _case("notifydispatch4@example.com")

        bus.dispatch(CaseBlocked(case_id=case.id, reason="Missing KYC documents"))

        notification = Notification.query.filter_by(user_id=client_user.id, category="case_blocked").one()
        assert "Missing KYC documents" in notification.body


def test_unread_count_and_mark_read_endpoints(app, client):
    with app.app_context():
        client_user, case = _case("notifydispatch5@example.com")
        stage1 = min(case.stages, key=lambda s: s.sequence_order)
        task = next(t for t in stage1.tasks if t.assignee_type == "client")
        bus.dispatch(TaskAwaitingClient(case_id=case.id, task_id=task.id))

        from tests.helpers import auth_headers

        headers = auth_headers(client_user)
        unread_resp = client.get("/notifications/unread-count", headers=headers)
        assert unread_resp.get_json()["count"] == 1

        list_resp = client.get("/notifications", headers=headers)
        notification_id = list_resp.get_json()[0]["id"]

        read_resp = client.post(f"/notifications/{notification_id}/read", headers=headers)
        assert read_resp.status_code == 200
        assert read_resp.get_json()["is_read"] is True

        unread_after = client.get("/notifications/unread-count", headers=headers)
        assert unread_after.get_json()["count"] == 0

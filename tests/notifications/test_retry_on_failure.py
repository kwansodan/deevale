import pytest

from app.core.enums import RoleName
from app.core.model_mixins import utcnow
from app.extensions import db
from app.notifications.models import Notification, NotificationDelivery
from app.notifications.tasks import MAX_ATTEMPTS, send_notification_delivery
from tests.helpers import make_user


def _pending_delivery(app):
    user = make_user(email="notifyretry@example.com", roles=[RoleName.CLIENT])
    notification = Notification(
        user_id=user.id,
        category="action_required",
        title="Test",
        body="Test body",
        created_at=utcnow(),
    )
    db.session.add(notification)
    db.session.flush()
    delivery = NotificationDelivery(notification_id=notification.id, channel="email", status="pending")
    db.session.add(delivery)
    db.session.commit()
    return delivery


def test_transient_failure_marks_delivery_retrying_and_records_error(app, monkeypatch):
    with app.app_context():
        delivery = _pending_delivery(app)

        class FailingSender:
            def send(self, *a, **kw):
                raise ConnectionError("SMTP server unreachable")

        monkeypatch.setattr("app.notifications.channels.email.get_email_sender", lambda: FailingSender())

        with pytest.raises(ConnectionError):
            send_notification_delivery.run(str(delivery.id))

        db.session.refresh(delivery)
        assert delivery.attempt_count == 1
        assert delivery.status == "retrying"
        assert "SMTP server unreachable" in delivery.last_error


def test_failure_after_max_attempts_marks_delivery_abandoned(app, monkeypatch):
    with app.app_context():
        delivery = _pending_delivery(app)
        delivery.attempt_count = MAX_ATTEMPTS - 1
        db.session.commit()

        class FailingSender:
            def send(self, *a, **kw):
                raise ConnectionError("still down")

        monkeypatch.setattr("app.notifications.channels.email.get_email_sender", lambda: FailingSender())

        with pytest.raises(ConnectionError):
            send_notification_delivery.run(str(delivery.id))

        db.session.refresh(delivery)
        assert delivery.attempt_count == MAX_ATTEMPTS
        assert delivery.status == "abandoned"


def test_successful_send_marks_delivery_sent(app, monkeypatch):
    with app.app_context():
        delivery = _pending_delivery(app)

        sent_calls = []

        class WorkingSender:
            def send(self, to_email, subject, html_body, text_body):
                sent_calls.append((to_email, subject))

        monkeypatch.setattr("app.notifications.channels.email.get_email_sender", lambda: WorkingSender())

        send_notification_delivery.run(str(delivery.id))

        db.session.refresh(delivery)
        assert delivery.status == "sent"
        assert delivery.sent_at is not None
        assert len(sent_calls) == 1

from app.core.model_mixins import utcnow
from app.extensions import socketio
from app.notifications.channels.base import ChannelAdapter
from app.notifications.enums import DeliveryStatus


class InAppChannel(ChannelAdapter):
    """Writes happen synchronously (the Notification row is already created
    by the dispatcher before any channel runs) -- this adapter just marks the
    delivery sent and pushes a live update over the user's socket room."""

    def deliver(self, user, notification, delivery, context: dict) -> None:
        delivery.status = DeliveryStatus.SENT.value
        delivery.sent_at = utcnow()
        socketio.emit(
            "notification",
            {
                "id": str(notification.id),
                "category": notification.category,
                "title": notification.title,
                "body": notification.body,
                "related_case_id": str(notification.related_case_id) if notification.related_case_id else None,
            },
            room=f"user:{user.id}",
        )

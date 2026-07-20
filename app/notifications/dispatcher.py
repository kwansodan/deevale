from app.auth.models import User
from app.core.model_mixins import utcnow
from app.extensions import db
from app.notifications.channels.email import EmailChannel
from app.notifications.channels.in_app import InAppChannel
from app.notifications.channels.sms import SmsChannel
from app.notifications.channels.whatsapp import WhatsAppChannel
from app.notifications.copy import render_notification
from app.notifications.enums import DeliveryChannel, NotificationCategory
from app.notifications.models import Notification, NotificationDelivery, NotificationPreference

_CHANNEL_ADAPTERS = {
    DeliveryChannel.IN_APP.value: InAppChannel(),
    DeliveryChannel.EMAIL.value: EmailChannel(),
    DeliveryChannel.SMS.value: SmsChannel(),
    DeliveryChannel.WHATSAPP.value: WhatsAppChannel(),
}

# PRD routing matrix: the channels each category uses when the user hasn't
# expressed a preference. Action-required and stage-completed default to
# in-app + email + SMS; everything else in-app + email. WhatsApp is opt-in
# everywhere (business-initiated messages need explicit consent).
_SMS_DEFAULT_CATEGORIES = {
    NotificationCategory.ACTION_REQUIRED.value,
    NotificationCategory.STAGE_COMPLETED.value,
}


def default_channel_enabled(category: str, channel: DeliveryChannel) -> bool:
    if channel in (DeliveryChannel.IN_APP, DeliveryChannel.EMAIL):
        return True
    if channel == DeliveryChannel.SMS:
        return category in _SMS_DEFAULT_CATEGORIES
    return False  # WhatsApp: opt-in only


def _wants_channel(user_id, category: str, channel: DeliveryChannel) -> bool:
    pref = NotificationPreference.query.filter_by(user_id=user_id, category=category).first()
    if pref is None:
        return default_channel_enabled(category, channel)
    if channel == DeliveryChannel.EMAIL:
        return pref.email_enabled
    if channel == DeliveryChannel.IN_APP:
        return pref.in_app_enabled
    if channel == DeliveryChannel.SMS:
        if pref.sms_enabled is None:
            return default_channel_enabled(category, channel)
        return pref.sms_enabled
    if pref.whatsapp_enabled is None:
        return default_channel_enabled(category, channel)
    return pref.whatsapp_enabled


class NotificationDispatcher:
    def notify(
        self, user: User, category: NotificationCategory, context: dict, related_case_id=None
    ) -> Notification:
        title, body = render_notification(category.value, context, locale=getattr(user, "locale", "en"))
        notification = Notification(
            user_id=user.id,
            category=category.value,
            title=title,
            body=body,
            related_case_id=related_case_id,
            created_at=utcnow(),
        )
        db.session.add(notification)
        db.session.flush()

        for channel_name, adapter in _CHANNEL_ADAPTERS.items():
            if not _wants_channel(user.id, category.value, DeliveryChannel(channel_name)):
                continue
            delivery = NotificationDelivery(
                notification_id=notification.id, channel=channel_name, status="pending"
            )
            db.session.add(delivery)
            db.session.flush()
            adapter.deliver(user, notification, delivery, context)

        db.session.commit()
        return notification


dispatcher = NotificationDispatcher()

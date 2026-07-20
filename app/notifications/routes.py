import uuid

from flask_jwt_extended import jwt_required
from flask_smorest import Blueprint

from app.core.current_user import get_current_user
from app.core.errors import NotFoundError
from app.core.model_mixins import utcnow
from app.extensions import db
from app.notifications.enums import CLIENT_CATEGORIES, STAFF_CATEGORIES, NotificationCategory
from app.notifications.models import Notification, NotificationPreference
from app.notifications.schemas import (
    NotificationPreferenceSchema,
    NotificationSchema,
    UnreadCountSchema,
    UpdatePreferencesRequestSchema,
)

blp = Blueprint("notifications", __name__, url_prefix="/notifications", description="Notification endpoints")

ALL_CATEGORIES = CLIENT_CATEGORIES | STAFF_CATEGORIES | {NotificationCategory.WEEKLY_DIGEST}


@blp.route("", methods=["GET"])
@jwt_required()
@blp.response(200, NotificationSchema(many=True))
def list_notifications_route():
    user = get_current_user()
    return Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).all()


@blp.route("/unread-count", methods=["GET"])
@jwt_required()
@blp.response(200, UnreadCountSchema)
def unread_count_route():
    user = get_current_user()
    count = Notification.query.filter_by(user_id=user.id, is_read=False).count()
    return {"count": count}


@blp.route("/<string:notification_id>/read", methods=["POST"])
@jwt_required()
@blp.response(200, NotificationSchema)
def mark_read_route(notification_id):
    user = get_current_user()
    try:
        notification_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise NotFoundError("Notification not found") from None

    notification = Notification.query.get(notification_uuid)
    if notification is None or notification.user_id != user.id:
        raise NotFoundError("Notification not found")

    notification.is_read = True
    notification.read_at = utcnow()
    db.session.commit()
    return notification


def _effective_preferences(user_id):
    """Every category with its effective channel settings -- stored rows where
    they exist, routing-matrix defaults otherwise (weekly digest defaults to
    off; it's opt-in)."""
    from app.notifications.dispatcher import default_channel_enabled
    from app.notifications.enums import DeliveryChannel

    existing = {p.category: p for p in NotificationPreference.query.filter_by(user_id=user_id).all()}
    result = []
    for category in NotificationCategory:
        pref = existing.get(category.value)
        if pref is not None:
            result.append(
                {
                    "category": category.value,
                    "email_enabled": pref.email_enabled,
                    "in_app_enabled": pref.in_app_enabled,
                    "sms_enabled": pref.sms_enabled
                    if pref.sms_enabled is not None
                    else default_channel_enabled(category.value, DeliveryChannel.SMS),
                    "whatsapp_enabled": pref.whatsapp_enabled
                    if pref.whatsapp_enabled is not None
                    else default_channel_enabled(category.value, DeliveryChannel.WHATSAPP),
                }
            )
        else:
            is_digest = category == NotificationCategory.WEEKLY_DIGEST
            result.append(
                {
                    "category": category.value,
                    "email_enabled": not is_digest,
                    "in_app_enabled": True,
                    "sms_enabled": default_channel_enabled(category.value, DeliveryChannel.SMS),
                    "whatsapp_enabled": default_channel_enabled(category.value, DeliveryChannel.WHATSAPP),
                }
            )
    return result


@blp.route("/preferences", methods=["GET"])
@jwt_required()
@blp.response(200, NotificationPreferenceSchema(many=True))
def get_preferences_route():
    user = get_current_user()
    return _effective_preferences(user.id)


@blp.route("/preferences", methods=["PUT"])
@jwt_required()
@blp.arguments(UpdatePreferencesRequestSchema)
@blp.response(200, NotificationPreferenceSchema(many=True))
def update_preferences_route(payload):
    user = get_current_user()
    for pref_data in payload["preferences"]:
        category = pref_data["category"]
        if category not in {c.value for c in ALL_CATEGORIES}:
            continue
        pref = NotificationPreference.query.filter_by(user_id=user.id, category=category).first()
        if pref is None:
            pref = NotificationPreference(user_id=user.id, category=category)
            db.session.add(pref)
        pref.email_enabled = pref_data["email_enabled"]
        pref.in_app_enabled = pref_data["in_app_enabled"]
        if pref_data.get("sms_enabled") is not None:
            pref.sms_enabled = pref_data["sms_enabled"]
        if pref_data.get("whatsapp_enabled") is not None:
            pref.whatsapp_enabled = pref_data["whatsapp_enabled"]
    db.session.commit()
    return _effective_preferences(user.id)

import uuid

from flask_smorest import Blueprint
from marshmallow import Schema, fields

from app.core.current_user import get_current_user
from app.core.enums import RoleName
from app.core.errors import NotFoundError
from app.core.rbac import require_roles
from app.extensions import db, socketio
from app.public import live_chat_service
from app.public.live_chat_models import LiveChatSession
from app.public.live_chat_schemas import (
    LiveChatMessageCreateSchema,
    LiveChatMessageSchema,
    LiveChatSessionSchema,
)

blp = Blueprint(
    "ops_live_chat",
    __name__,
    url_prefix="/ops/live-chat",
    description="Staff operations endpoints for Live Chat and Visitor Presence",
)

STAFF_ROLES = [
    RoleName.CASE_OFFICER,
    RoleName.ADMIN,
    RoleName.REVIEWER,
    RoleName.FINANCE,
]


class SessionFilterSchema(Schema):
    status = fields.String(load_default=None, allow_none=True)


@blp.route("/visitors", methods=["GET"])
@require_roles(*STAFF_ROLES)
@blp.response(200, LiveChatSessionSchema(many=True))
def list_active_visitors_route():
    """Lists real-time online visitors and active sessions."""
    return live_chat_service.get_active_visitors()


@blp.route("/sessions", methods=["GET"])
@require_roles(*STAFF_ROLES)
@blp.arguments(SessionFilterSchema, location="query")
@blp.response(200, LiveChatSessionSchema(many=True))
def list_chat_sessions_route(query_args):
    """Lists all chat sessions with optional status filter."""
    return live_chat_service.list_sessions(status=query_args.get("status"))


@blp.route("/sessions/<string:session_id>", methods=["GET"])
@require_roles(*STAFF_ROLES)
@blp.response(200, LiveChatSessionSchema)
def get_chat_session_route(session_id):
    """Fetches details and full message transcript for a session."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise NotFoundError("Session not found") from None

    session = LiveChatSession.query.get(session_uuid)
    if not session:
        raise NotFoundError("Session not found")

    live_chat_service.mark_messages_read(session.id, reader="staff")
    return session.to_dict(include_messages=True)


@blp.route("/sessions/<string:session_id>/messages", methods=["POST"])
@require_roles(*STAFF_ROLES)
@blp.arguments(LiveChatMessageCreateSchema)
@blp.response(201, LiveChatMessageSchema)
def staff_send_message_route(payload, session_id):
    """Staff sends a message or initiates a chat with the visitor."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise NotFoundError("Session not found") from None

    session = LiveChatSession.query.get(session_uuid)
    if not session:
        raise NotFoundError("Session not found")

    user = get_current_user()
    msg = live_chat_service.add_message(
        session_id=session.id,
        sender_type="staff",
        body=payload["body"],
        sender_user_id=user.id,
        sender_name=user.full_name,
    )

    msg_dict = msg.to_dict()
    # Real-time broadcast to visitor room & staff room
    try:
        socketio.emit("chat:incoming_message", msg_dict, room=f"visitor:{session.visitor_id}")
        socketio.emit("chat:incoming_message", msg_dict, room="ops:live_chat")
    except Exception:
        pass

    return msg_dict


@blp.route("/sessions/<string:session_id>/close", methods=["PATCH"])
@require_roles(*STAFF_ROLES)
@blp.response(200, LiveChatSessionSchema)
def close_chat_session_route(session_id):
    """Marks a live chat conversation as closed / resolved."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise NotFoundError("Session not found") from None

    session = LiveChatSession.query.get(session_uuid)
    if not session:
        raise NotFoundError("Session not found")

    session.status = "closed"
    db.session.commit()

    session_dict = session.to_dict(include_messages=True)
    try:
        socketio.emit("visitor:presence", session_dict, room="ops:live_chat")
        socketio.emit("visitor:presence", session_dict, room=f"visitor:{session.visitor_id}")
    except Exception:
        pass

    return session_dict

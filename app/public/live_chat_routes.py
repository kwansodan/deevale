import uuid

from flask import request
from flask_smorest import Blueprint

from app.core.errors import NotFoundError
from app.extensions import socketio
from app.public import live_chat_service
from app.public.live_chat_models import LiveChatSession
from app.public.live_chat_schemas import (
    LiveChatContactUpdateSchema,
    LiveChatMessageCreateSchema,
    LiveChatMessageSchema,
    LiveChatSessionInitSchema,
    LiveChatSessionSchema,
)

blp = Blueprint(
    "public_live_chat",
    __name__,
    url_prefix="/public/live-chat",
    description="Public visitor live chat endpoints",
)


@blp.route("/session", methods=["POST"])
@blp.arguments(LiveChatSessionInitSchema)
@blp.response(200, LiveChatSessionSchema)
def init_session_route(payload):
    """Initializes or resumes a visitor session and returns message history."""
    ip_address = request.headers.get("X-Forwarded-For", request.remote_addr)
    if ip_address and "," in ip_address:
        ip_address = ip_address.split(",")[0].strip()

    user_agent = payload.get("user_agent") or request.headers.get("User-Agent")
    session = live_chat_service.get_or_create_session(
        visitor_id=payload["visitor_id"],
        page=payload.get("page", "/"),
        referrer=payload.get("referrer"),
        user_agent=user_agent,
        ip_address=ip_address,
    )

    # Notify staff on ops:live_chat of visitor presence
    session_dict = session.to_dict(include_messages=True)
    try:
        socketio.emit("visitor:presence", session_dict, room="ops:live_chat")
    except Exception:
        pass

    return session_dict


@blp.route("/sessions/<string:session_id>/messages", methods=["GET"])
@blp.response(200, LiveChatMessageSchema(many=True))
def get_session_messages_route(session_id):
    """Retrieves all messages for a visitor session."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise NotFoundError("Session not found") from None

    session = LiveChatSession.query.get(session_uuid)
    if not session:
        raise NotFoundError("Session not found")

    live_chat_service.mark_messages_read(session.id, reader="visitor")
    return [m.to_dict() for m in session.messages]


@blp.route("/sessions/<string:session_id>/messages", methods=["POST"])
@blp.arguments(LiveChatMessageCreateSchema)
@blp.response(201, LiveChatMessageSchema)
def create_session_message_route(payload, session_id):
    """Visitor sends a new message to staff."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise NotFoundError("Session not found") from None

    session = LiveChatSession.query.get(session_uuid)
    if not session:
        raise NotFoundError("Session not found")

    msg = live_chat_service.add_message(
        session_id=session.id,
        sender_type="visitor",
        body=payload["body"],
        sender_name=payload.get("sender_name") or session.visitor_name,
    )

    msg_dict = msg.to_dict()
    # Emit real-time message to staff and visitor rooms
    try:
        socketio.emit("chat:incoming_message", msg_dict, room="ops:live_chat")
        socketio.emit("chat:incoming_message", msg_dict, room=f"visitor:{session.visitor_id}")
        socketio.emit("chat:incoming_message", msg_dict, room=f"session:{session.id}")
    except Exception:
        pass

    return msg_dict


@blp.route("/sessions/<string:session_id>/contact", methods=["PATCH"])
@blp.arguments(LiveChatContactUpdateSchema)
@blp.response(200, LiveChatSessionSchema)
def update_contact_route(payload, session_id):
    """Visitor updates their contact details (name, email, phone)."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise NotFoundError("Session not found") from None

    try:
        session = live_chat_service.update_visitor_contact(
            session_id=session_uuid,
            visitor_name=payload.get("visitor_name"),
            visitor_email=payload.get("visitor_email"),
            visitor_phone=payload.get("visitor_phone"),
        )
    except ValueError:
        raise NotFoundError("Session not found") from None

    session_dict = session.to_dict(include_messages=True)
    try:
        socketio.emit("visitor:presence", session_dict, room="ops:live_chat")
    except Exception:
        pass

    return session_dict

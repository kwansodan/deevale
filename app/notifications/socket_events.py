import logging
import uuid

from flask import request
from flask_jwt_extended import decode_token
from flask_socketio import join_room

from app.auth.models import User
from app.core.enums import STAFF_ROLES
from app.extensions import socketio
from app.public import live_chat_service
from app.public.live_chat_models import LiveChatSession

logger = logging.getLogger("deevalegh.socket_events")

# Map sid to visitor_id or user_id for disconnect tracking
_SOCKET_SESSIONS: dict[str, dict] = {}


def register_socket_events() -> None:
    @socketio.on("connect")
    def handle_connect(auth=None):
        sid = request.sid
        auth_data = auth if isinstance(auth, dict) else {}
        token = auth_data.get("token")

        if token:
            try:
                decoded = decode_token(token)
                user_id = decoded["sub"]
                join_room(f"user:{user_id}")

                # Check if user is staff to join ops live chat room
                user = User.query.get(uuid.UUID(user_id))
                if user and any(r.name in [sr.value for sr in STAFF_ROLES] for r in user.roles):
                    join_room("ops:live_chat")
                    _SOCKET_SESSIONS[sid] = {"type": "staff", "user_id": user_id, "name": user.full_name}
                    logger.info("Staff user %s connected to ops:live_chat (sid=%s)", user.email, sid)
                else:
                    _SOCKET_SESSIONS[sid] = {"type": "client", "user_id": user_id}

                return True
            except Exception as exc:
                logger.warning("Socket auth token decode failed: %s", exc)

        # Visitor connection
        visitor_id = auth_data.get("visitor_id")
        if visitor_id:
            visitor_id = str(visitor_id).strip()
            join_room(f"visitor:{visitor_id}")
            page = auth_data.get("page", "/")
            referrer = auth_data.get("referrer")
            user_agent = request.headers.get("User-Agent")
            ip = request.headers.get("X-Forwarded-For", request.remote_addr)
            if ip and "," in ip:
                ip = ip.split(",")[0].strip()

            try:
                session = live_chat_service.get_or_create_session(
                    visitor_id=visitor_id,
                    page=page,
                    referrer=referrer,
                    user_agent=user_agent,
                    ip_address=ip,
                )
                join_room(f"session:{session.id}")
                _SOCKET_SESSIONS[sid] = {
                    "type": "visitor",
                    "visitor_id": visitor_id,
                    "session_id": str(session.id),
                }
                # Broadcast visitor arrival to staff in ops console
                socketio.emit("visitor:presence", session.to_dict(include_messages=True), room="ops:live_chat")
            except Exception as e:
                logger.error("Failed to register visitor session on socket connect: %s", e)

            return True

        # Allow unauthenticated guest connections
        _SOCKET_SESSIONS[sid] = {"type": "guest"}
        return True

    @socketio.on("chat:join")
    def handle_chat_join(data):
        """Allows visitor or staff to join a specific session room explicitly."""
        if not isinstance(data, dict):
            return
        visitor_id = data.get("visitor_id")
        session_id = data.get("session_id")
        if visitor_id:
            join_room(f"visitor:{visitor_id}")
        if session_id:
            join_room(f"session:{session_id}")

    @socketio.on("visitor:page_view")
    def handle_visitor_page_view(data):
        if not isinstance(data, dict):
            return
        visitor_id = data.get("visitor_id")
        page = data.get("page", "/")
        if visitor_id:
            session = live_chat_service.update_visitor_presence(visitor_id=visitor_id, is_online=True, page=page)
            if session:
                socketio.emit("visitor:presence", session.to_dict(include_messages=True), room="ops:live_chat")

    @socketio.on("visitor:heartbeat")
    def handle_visitor_heartbeat(data):
        if not isinstance(data, dict):
            return
        visitor_id = data.get("visitor_id")
        if visitor_id:
            live_chat_service.update_visitor_presence(visitor_id=visitor_id, is_online=True)

    @socketio.on("chat:message")
    def handle_chat_message(data):
        if not isinstance(data, dict):
            return
        session_id_str = data.get("session_id")
        body = data.get("body", "").strip()
        sender_type = data.get("sender_type", "visitor")
        sender_name = data.get("sender_name")
        token = data.get("token")

        if not session_id_str or not body:
            return

        try:
            session_uuid = uuid.UUID(session_id_str)
        except ValueError:
            return

        sender_user_id = None
        if token:
            try:
                decoded = decode_token(token)
                sender_user_id = uuid.UUID(decoded["sub"])
                user = User.query.get(sender_user_id)
                if user:
                    sender_name = user.full_name
                    sender_type = "staff"
            except Exception:
                pass

        try:
            msg = live_chat_service.add_message(
                session_id=session_uuid,
                sender_type=sender_type,
                body=body,
                sender_user_id=sender_user_id,
                sender_name=sender_name,
            )
            msg_dict = msg.to_dict()

            # Target both visitor_id room and session_id room
            chat_session = LiveChatSession.query.get(session_uuid)
            if chat_session:
                socketio.emit("chat:incoming_message", msg_dict, room=f"visitor:{chat_session.visitor_id}")
                socketio.emit("chat:incoming_message", msg_dict, room=f"session:{chat_session.id}")

            # Also deliver to ops staff room
            socketio.emit("chat:incoming_message", msg_dict, room="ops:live_chat")
        except Exception as e:
            logger.error("Error processing chat message: %s", e)

    @socketio.on("chat:typing")
    def handle_chat_typing(data):
        if not isinstance(data, dict):
            return
        visitor_id = data.get("visitor_id")
        session_id = data.get("session_id")
        is_typing = data.get("is_typing", False)
        sender_type = data.get("sender_type", "visitor")
        sender_name = data.get("sender_name", "")

        payload = {
            "session_id": session_id,
            "visitor_id": visitor_id,
            "is_typing": is_typing,
            "sender_type": sender_type,
            "sender_name": sender_name,
        }

        if sender_type == "visitor":
            socketio.emit("chat:typing", payload, room="ops:live_chat")
        else:
            if visitor_id:
                socketio.emit("chat:typing", payload, room=f"visitor:{visitor_id}")
            if session_id:
                socketio.emit("chat:typing", payload, room=f"session:{session_id}")

    @socketio.on("disconnect")
    def handle_disconnect():
        sid = request.sid
        info = _SOCKET_SESSIONS.pop(sid, None)
        if info and info.get("type") == "visitor":
            visitor_id = info.get("visitor_id")
            session = live_chat_service.update_visitor_presence(visitor_id=visitor_id, is_online=False)
            if session:
                socketio.emit("visitor:presence", session.to_dict(include_messages=True), room="ops:live_chat")

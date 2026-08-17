import logging

from flask import request
from flask_jwt_extended import decode_token
from flask_socketio import join_room

from app.extensions import socketio

logger = logging.getLogger("deevalegh.socket_events")


def register_socket_events() -> None:
    @socketio.on("connect")
    def handle_connect(auth=None):
        token = auth.get("token") if isinstance(auth, dict) else None
        if not token:
            return False
        try:
            decoded = decode_token(token)
            user_id = decoded["sub"]
            join_room(f"user:{user_id}")
            logger.info("Socket client connected and joined room user:%s (sid=%s)", user_id, request.sid)
            return True
        except Exception as exc:
            logger.warning("Socket connect rejected: %s", exc)
            return False

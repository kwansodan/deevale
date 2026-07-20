from flask_jwt_extended import decode_token
from flask_socketio import join_room

from app.extensions import socketio


def register_socket_events() -> None:
    @socketio.on("connect")
    def handle_connect(auth=None):
        token = auth.get("token") if isinstance(auth, dict) else None
        if not token:
            return False
        try:
            decoded = decode_token(token)
        except Exception:
            return False
        join_room(f"user:{decoded['sub']}")
        return True

import logging
import uuid
from datetime import timedelta

from app.core.model_mixins import utcnow
from app.extensions import db
from app.public.live_chat_models import LiveChatMessage, LiveChatSession

logger = logging.getLogger("deevalegh.live_chat")


def get_or_create_session(
    visitor_id: str,
    page: str = "/",
    referrer: str | None = None,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> LiveChatSession:
    """Finds an existing active session for this visitor or creates a new one."""
    visitor_id = visitor_id.strip()
    session = (
        LiveChatSession.query.filter_by(visitor_id=visitor_id, status="active")
        .order_by(LiveChatSession.created_at.desc())
        .first()
    )

    if session is None:
        session = LiveChatSession(
            visitor_id=visitor_id,
            current_page=page or "/",
            referrer=referrer,
            user_agent=user_agent,
            ip_address=ip_address,
            is_online=True,
            last_seen_at=utcnow(),
        )
        db.session.add(session)
    else:
        session.current_page = page or session.current_page
        session.is_online = True
        session.last_seen_at = utcnow()
        if user_agent and not session.user_agent:
            session.user_agent = user_agent
        if referrer and not session.referrer:
            session.referrer = referrer
        if ip_address and not session.ip_address:
            session.ip_address = ip_address

    db.session.commit()
    return session


def update_visitor_presence(visitor_id: str, is_online: bool, page: str | None = None) -> LiveChatSession | None:
    session = (
        LiveChatSession.query.filter_by(visitor_id=visitor_id, status="active")
        .order_by(LiveChatSession.created_at.desc())
        .first()
    )
    if session:
        session.is_online = is_online
        session.last_seen_at = utcnow()
        if page:
            session.current_page = page
        db.session.commit()
    return session


def update_visitor_contact(
    session_id: uuid.UUID,
    visitor_name: str | None = None,
    visitor_email: str | None = None,
    visitor_phone: str | None = None,
) -> LiveChatSession:
    session = LiveChatSession.query.get(session_id)
    if not session:
        raise ValueError("Session not found")

    if visitor_name is not None:
        session.visitor_name = visitor_name.strip() or None
    if visitor_email is not None:
        session.visitor_email = visitor_email.strip() or None
    if visitor_phone is not None:
        session.visitor_phone = visitor_phone.strip() or None

    db.session.commit()
    return session


def add_message(
    session_id: uuid.UUID,
    sender_type: str,
    body: str,
    sender_user_id: uuid.UUID | None = None,
    sender_name: str | None = None,
) -> LiveChatMessage:
    session = LiveChatSession.query.get(session_id)
    if not session:
        raise ValueError("Session not found")

    msg = LiveChatMessage(
        session_id=session.id,
        sender_type=sender_type,
        sender_user_id=sender_user_id,
        sender_name=sender_name,
        body=body.strip(),
        created_at=utcnow(),
    )
    session.last_seen_at = utcnow()
    session.updated_at = utcnow()
    db.session.add(msg)
    db.session.commit()

    if sender_type == "visitor":
        # Schedule an offline / unread email notification check
        try:
            from app.public.live_chat_tasks import notify_staff_of_visitor_message

            notify_staff_of_visitor_message.apply_async(
                args=[str(session.id), str(msg.id)],
                countdown=30,  # 30-second delay: if staff answer immediately, no email is sent
            )
        except Exception as e:
            logger.warning("Failed to queue live chat notification task: %s", e)

    return msg


def mark_messages_read(session_id: uuid.UUID, reader: str = "staff") -> int:
    """Marks unread messages as read depending on who is reading."""
    session = LiveChatSession.query.get(session_id)
    if not session:
        return 0

    target_sender = "visitor" if reader == "staff" else "staff"
    unread_messages = [m for m in session.messages if m.sender_type == target_sender and m.read_at is None]
    now = utcnow()
    for m in unread_messages:
        m.read_at = now

    if unread_messages:
        db.session.commit()
    return len(unread_messages)


def get_active_visitors() -> list[dict]:
    """Returns currently online visitors or those active in the last 5 minutes."""
    cutoff = utcnow() - timedelta(minutes=5)
    sessions = (
        LiveChatSession.query.filter(
            LiveChatSession.is_online.is_(True) | (LiveChatSession.last_seen_at >= cutoff)
        )
        .order_by(LiveChatSession.last_seen_at.desc())
        .all()
    )
    return [s.to_dict(include_messages=True) for s in sessions]


def list_sessions(status: str | None = None, limit: int = 50) -> list[dict]:
    query = LiveChatSession.query
    if status:
        query = query.filter_by(status=status)
    sessions = query.order_by(LiveChatSession.updated_at.desc()).limit(limit).all()
    return [s.to_dict(include_messages=True) for s in sessions]

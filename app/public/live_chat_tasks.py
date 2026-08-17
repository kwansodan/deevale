import logging
import uuid

from flask import current_app

from app.auth.models import Role, User
from app.celery_app import celery_app
from app.core.enums import RoleName
from app.notifications.channels.email import get_email_sender
from app.public.live_chat_models import LiveChatMessage, LiveChatSession

logger = logging.getLogger("deevalegh.live_chat")


@celery_app.task(name="app.public.live_chat_tasks.notify_staff_of_visitor_message")
def notify_staff_of_visitor_message(session_id_str: str, message_id_str: str) -> bool:
    try:
        session_id = uuid.UUID(session_id_str)
        message_id = uuid.UUID(message_id_str)
    except ValueError:
        return False

    session = LiveChatSession.query.get(session_id)
    message = LiveChatMessage.query.get(message_id)

    if not session or not message:
        return False

    # If already read by staff, no email notification is needed
    if message.read_at is not None:
        logger.info("Message %s already read by staff; skipping email alert.", message_id_str)
        return False

    # Find staff emails
    staff_emails = []
    # If assigned officer has an email, use them
    if session.assigned_officer and session.assigned_officer.email:
        staff_emails.append(session.assigned_officer.email)
    else:
        # Otherwise query active admins & case officers
        staff_users = (
            User.query.join(User.roles)
            .filter(
                User.is_active.is_(True),
                Role.name.in_([RoleName.ADMIN.value, RoleName.CASE_OFFICER.value]),
            )
            .all()
        )
        staff_emails = [u.email for u in staff_users if u.email]

    if not staff_emails:
        fallback = current_app.config.get("UPTIME_ALERT_EMAIL")
        if fallback:
            staff_emails = [fallback]

    if not staff_emails:
        logger.warning("No staff email addresses found to notify for live chat message.")
        return False

    visitor_label = session.visitor_name or f"Visitor ({session.visitor_id[:8]})"
    if session.visitor_email:
        visitor_label += f" <{session.visitor_email}>"

    frontend_base = current_app.config.get("CORS_ORIGINS", ["https://app.deevalegh.com"])[0].rstrip("/")
    chat_url = f"{frontend_base}/ops/live-chat?session={session.id}"

    subject = f"💬 [Live Chat] New message from {visitor_label}"
    lines = [
        f"A website visitor sent a live chat message on {session.current_page}:",
        "",
        f'"{message.body}"',
        "",
        f"Visitor: {visitor_label}",
        f"Phone: {session.visitor_phone or 'Not provided'}",
        f"Page: {session.current_page}",
        f"Referrer: {session.referrer or 'Direct'}",
        "",
        f"Reply directly in Ops Console: {chat_url}",
    ]
    text_body = "\n".join(lines)
    html_body = f"""
    <div style="font-family: sans-serif; color: #111; line-height: 1.5;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">New Live Chat Message</h2>
        <p style="color: #555; margin-top: 0;">A visitor on <strong>{session.current_page}</strong> is waiting for assistance:</p>
        <blockquote style="border-left: 4px solid #000; padding: 8px 16px; margin: 16px 0; background: #f9f9f9; font-size: 16px;">
            {message.body}
        </blockquote>
        <table style="font-size: 14px; color: #444; margin-bottom: 20px;">
            <tr><td><strong>Visitor:</strong></td><td>{visitor_label}</td></tr>
            <tr><td><strong>Phone:</strong></td><td>{session.visitor_phone or 'Not provided'}</td></tr>
            <tr><td><strong>Page:</strong></td><td>{session.current_page}</td></tr>
            <tr><td><strong>Referrer:</strong></td><td>{session.referrer or 'Direct'}</td></tr>
        </table>
        <p>
            <a href="{chat_url}" style="background: #000; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Open Live Chat in Ops Console &rarr;
            </a>
        </p>
    </div>
    """

    sender = get_email_sender()
    for email in staff_emails:
        try:
            sender.send(email, subject, html_body, text_body)
        except Exception as exc:
            logger.exception("Failed to send live chat email alert to %s: %s", email, exc)

    return True

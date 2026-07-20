from app.celery_app import celery_app

MAX_ATTEMPTS = 5


@celery_app.task(
    name="app.notifications.tasks.send_notification_delivery",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=MAX_ATTEMPTS,
)
def send_notification_delivery(self, delivery_id: str) -> None:
    """Sends one delivery over its channel (email / SMS / WhatsApp), with
    retry bookkeeping shared across channels."""
    from flask import render_template

    from app.auth.models import User
    from app.core.model_mixins import utcnow
    from app.extensions import db
    from app.notifications.channels.email import get_email_sender
    from app.notifications.channels.sms import get_sms_sender
    from app.notifications.channels.whatsapp import get_whatsapp_sender
    from app.notifications.models import Notification, NotificationDelivery

    delivery = NotificationDelivery.query.get(delivery_id)
    if delivery is None:
        return
    notification = Notification.query.get(delivery.notification_id)
    user = User.query.get(notification.user_id)

    try:
        if delivery.channel == "email":
            html_body = render_template(
                "notifications/email/base.html.j2", title=notification.title, body=notification.body
            )
            text_body = render_template(
                "notifications/email/base.txt.j2", title=notification.title, body=notification.body
            )
            get_email_sender().send(user.email, notification.title, html_body, text_body)
        elif delivery.channel == "sms":
            cost = get_sms_sender().send(user.phone, f"{notification.title} — {notification.body}")
            delivery.cost_minor = cost
        elif delivery.channel == "whatsapp":
            payload = delivery.payload or {}
            cost = get_whatsapp_sender().send_template(
                user.phone, payload.get("template_name", ""), payload.get("variables", [])
            )
            delivery.cost_minor = cost
        else:
            return  # in_app deliveries are completed synchronously by their adapter
    except Exception as exc:
        delivery.attempt_count += 1
        delivery.last_error = str(exc)
        delivery.status = "abandoned" if delivery.attempt_count >= MAX_ATTEMPTS else "retrying"
        db.session.commit()
        raise

    delivery.status = "sent"
    delivery.sent_at = utcnow()
    db.session.commit()


@celery_app.task(name="app.notifications.tasks.flush_queued_sms")
def flush_queued_sms() -> int:
    """Releases SMS deliveries held during Ghana quiet hours once the window
    has passed. Runs every 15 minutes via beat."""
    from app.core.model_mixins import utcnow
    from app.extensions import db
    from app.notifications.channels.sms import in_quiet_hours
    from app.notifications.models import NotificationDelivery

    if in_quiet_hours():
        return 0

    due = NotificationDelivery.query.filter(
        NotificationDelivery.channel == "sms",
        NotificationDelivery.status == "queued",
        NotificationDelivery.next_retry_at <= utcnow(),
    ).all()
    for delivery in due:
        delivery.status = "pending"
        send_notification_delivery.delay(str(delivery.id))
    db.session.commit()
    return len(due)


@celery_app.task(name="app.notifications.tasks.send_weekly_digests")
def send_weekly_digests() -> int:
    """Sunday-evening digest email: case progress + upcoming deadlines.
    Opt-in via the 'weekly_digest' preference category."""
    from flask import render_template

    from app.auth.models import User
    from app.core.model_mixins import utcnow
    from app.notifications.channels.email import get_email_sender
    from app.notifications.models import NotificationPreference
    from app.workflow.models import BusinessCase

    opted_in = NotificationPreference.query.filter_by(category="weekly_digest", email_enabled=True).all()
    sent = 0
    for pref in opted_in:
        user = User.query.get(pref.user_id)
        if user is None or not user.is_active:
            continue
        cases = BusinessCase.query.filter_by(client_id=user.id).all()
        if not cases:
            continue

        case_lines = []
        deadline_lines = []
        for case in cases:
            business_name = (case.onboarding_payload or {}).get("business_name", case.case_number)
            active = [s for s in case.stages if s.status in ("in_progress", "blocked_on_payment")]
            stage_text = active[0].name if active else ("Completed" if case.status == "completed" else "Queued")
            case_lines.append(f"{business_name}: {stage_text}")
            for stage in case.stages:
                if stage.deadline_at and stage.status in ("in_progress", "not_started"):
                    days = (stage.deadline_at - utcnow()).days
                    if 0 <= days <= 14:
                        deadline_lines.append(f"{business_name} — {stage.name} deadline in {days} day(s)")

        body = "Your week at a glance:\n" + "\n".join(f"• {line}" for line in case_lines)
        if deadline_lines:
            body += "\n\nUpcoming deadlines:\n" + "\n".join(f"⏰ {line}" for line in deadline_lines)

        html = render_template(
            "notifications/email/base.html.j2", title="Your LaunchGH weekly update", body=body
        )
        text = render_template(
            "notifications/email/base.txt.j2", title="Your LaunchGH weekly update", body=body
        )
        get_email_sender().send(user.email, "Your LaunchGH weekly update", html, text)
        sent += 1
    return sent

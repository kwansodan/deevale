from app.celery_app import celery_app


@celery_app.task(name="app.mailroom.tasks.shred_expired_mail")
def shred_expired_mail() -> int:
    """Retention policy: mail scans past their shred_after date have the scan
    object deleted from storage and are marked shredded. An open forwarding
    request holds a scan back so staff can still fulfil it."""
    from datetime import date

    from flask import current_app

    from app.core.audit import write_audit_log
    from app.extensions import db
    from app.mailroom.models import MailForwardRequest, MailItem
    from app.mailroom.storage import get_s3_client

    today = date.today()
    due = MailItem.query.filter(
        MailItem.status == "scanned",
        MailItem.shred_after.isnot(None),
        MailItem.shred_after < today,
        MailItem.scan_s3_key.isnot(None),
    ).all()

    shredded = 0
    bucket = current_app.config["S3_BUCKET"]
    client = get_s3_client()
    for mail in due:
        open_forward = MailForwardRequest.query.filter(
            MailForwardRequest.mail_item_id == mail.id,
            MailForwardRequest.status.in_(["new", "in_progress"]),
        ).first()
        if open_forward is not None:
            continue  # keep until the physical item is forwarded

        try:
            client.delete_object(Bucket=bucket, Key=mail.scan_s3_key)
        except Exception:  # noqa: BLE001 -- best-effort; still mark shredded
            pass
        mail.status = "shredded"
        from app.core.model_mixins import utcnow

        mail.shredded_at = utcnow()
        mail.scan_s3_key = None
        write_audit_log(
            action="mail_shredded",
            actor_user_id=None,
            entity_type="mail_item",
            entity_id=mail.id,
        )
        shredded += 1

    db.session.commit()
    return shredded

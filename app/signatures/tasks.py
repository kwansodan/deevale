from app.celery_app import celery_app

REMINDER_AFTER_HOURS = 48


@celery_app.task(name="app.signatures.tasks.assemble_signed_pdf")
def assemble_signed_pdf(request_id: str) -> None:
    """Renders the completed document plus a signature block (each signer's
    name, drawn/typed mark, timestamp and IP, flagged 'simple electronic
    signature'), stores it to S3, and attaches it to the case + task."""
    import weasyprint
    from flask import current_app, render_template

    from app.documents.storage import get_s3_client
    from app.signatures.models import SignatureRequest
    from app.signatures.service import attach_signed_document

    request = SignatureRequest.query.get(request_id)
    if request is None or request.status != "completed":
        return

    html = render_template("signatures/signed_document.html.j2", request=request, parties=request.parties)
    pdf_bytes = weasyprint.HTML(string=html).write_pdf()

    s3_key = f"cases/{request.business_case_id}/signatures/{request.id}.pdf"
    get_s3_client().put_object(
        Bucket=current_app.config["S3_BUCKET"], Key=s3_key, Body=pdf_bytes, ContentType="application/pdf"
    )
    attach_signed_document(request, s3_key)


@celery_app.task(name="app.signatures.tasks.remind_unsigned_parties")
def remind_unsigned_parties() -> int:
    """Reminds the current signer of any sent request whose turn has been open
    for more than 48h without a signature."""
    from datetime import timedelta

    from app.core.model_mixins import utcnow
    from app.extensions import db
    from app.notifications.channels.email import get_email_sender
    from app.signatures.models import SignatureRequest
    from app.signatures.service import next_signer

    now = utcnow()
    cutoff = now - timedelta(hours=REMINDER_AFTER_HOURS)
    reminded = 0

    sent_requests = SignatureRequest.query.filter_by(status="sent").all()
    for request in sent_requests:
        signer = next_signer(request)
        if signer is None:
            continue
        # Only remind once the request (or the prior reminder) is >48h old.
        since = signer.reminder_sent_at or request.sent_at or request.created_at
        if since is None or since > cutoff:
            continue
        get_email_sender().send(
            signer.email,
            f"Reminder: please sign {request.title}",
            f"<p>{signer.name}, your signature is still needed on '{request.title}'.</p>",
            f"{signer.name}, your signature is still needed on '{request.title}'.",
        )
        signer.reminder_sent_at = now
        reminded += 1

    db.session.commit()
    return reminded

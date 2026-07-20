from app.celery_app import celery_app


@celery_app.task(name="app.bookkeeping.tasks.generate_invoice_pdf")
def generate_invoice_pdf(invoice_id: str) -> None:
    """Renders a branded PDF for a client-issued invoice, stores it to S3, and
    (if the customer email is set) emails a pay link. WeasyPrint is imported
    lazily -- see payments.tasks.generate_receipt_pdf for the rationale."""
    import weasyprint
    from flask import current_app, render_template

    from app.bookkeeping.models import BusinessProfile, ClientInvoice
    from app.documents.storage import get_s3_client
    from app.extensions import db
    from app.notifications.channels.email import get_email_sender

    invoice = ClientInvoice.query.get(invoice_id)
    if invoice is None:
        return
    profile = BusinessProfile.query.filter_by(business_case_id=invoice.business_case_id).first()

    html = render_template("bookkeeping/client_invoice.html.j2", invoice=invoice, profile=profile)
    pdf_bytes = weasyprint.HTML(string=html).write_pdf()

    s3_key = f"cases/{invoice.business_case_id}/client_invoices/{invoice.invoice_number}.pdf"
    get_s3_client().put_object(
        Bucket=current_app.config["S3_BUCKET"], Key=s3_key, Body=pdf_bytes, ContentType="application/pdf"
    )
    invoice.pdf_s3_key = s3_key
    db.session.commit()

    if invoice.customer_email:
        share_url = f"{current_app.config['CORS_ORIGINS'][0]}/pay/{invoice.share_token}"
        business_name = profile.display_name if profile else "A business"
        body = (
            f"{business_name} has sent you invoice {invoice.invoice_number} "
            f"({invoice.currency} {invoice.total_minor / 100:.2f}).\n\nView it here: {share_url}"
        )
        html_body = render_template(
            "notifications/email/base.html.j2", title=f"Invoice {invoice.invoice_number}", body=body
        )
        text_body = render_template(
            "notifications/email/base.txt.j2", title=f"Invoice {invoice.invoice_number}", body=body
        )
        get_email_sender().send(
            invoice.customer_email, f"Invoice {invoice.invoice_number} from {business_name}", html_body, text_body
        )


@celery_app.task(name="app.bookkeeping.tasks.mark_overdue_invoices")
def mark_overdue_invoices() -> int:
    """Daily: flips sent invoices past their due date to overdue."""
    from datetime import date

    from app.bookkeeping.models import ClientInvoice
    from app.extensions import db

    today = date.today()
    due = ClientInvoice.query.filter(
        ClientInvoice.status == "sent",
        ClientInvoice.due_date.isnot(None),
        ClientInvoice.due_date < today,
    ).all()
    for invoice in due:
        invoice.status = "overdue"
    db.session.commit()
    return len(due)

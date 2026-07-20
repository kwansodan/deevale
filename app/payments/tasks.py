from app.celery_app import celery_app


@celery_app.task(name="app.payments.tasks.generate_receipt_pdf")
def generate_receipt_pdf(invoice_id: str) -> None:
    """Renders a receipt PDF for a paid invoice and stores it to S3, linking
    it back onto the Invoice. WeasyPrint (and its native Pango/Cairo
    dependencies) is imported lazily inside the task body rather than at
    module load time: those system libraries are only guaranteed present in
    the Linux worker container (installed via apt in the Dockerfile), not on
    every developer machine that might import this module.
    """
    import weasyprint
    from flask import render_template

    from app.documents.storage import get_s3_client
    from app.extensions import db
    from app.payments.models import Invoice

    invoice = Invoice.query.get(invoice_id)
    if invoice is None:
        return

    html = render_template("receipts/receipt.html.j2", invoice=invoice)
    pdf_bytes = weasyprint.HTML(string=html).write_pdf()

    from flask import current_app

    s3_key = f"cases/{invoice.business_case_id}/receipts/{invoice.invoice_number}.pdf"
    client = get_s3_client()
    client.put_object(
        Bucket=current_app.config["S3_BUCKET"], Key=s3_key, Body=pdf_bytes, ContentType="application/pdf"
    )

    invoice.receipt_s3_key = s3_key
    db.session.commit()

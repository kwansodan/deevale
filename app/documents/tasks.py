from app.celery_app import celery_app


@celery_app.task(name="app.documents.tasks.scan_document_version")
def scan_document_version(document_version_id: str) -> None:
    """Stub virus-scan task: no-op, marks every upload clean.

    TODO: integrate ClamAV (e.g. via a clamd daemon sidecar) once available in
    the deployment environment. Interface is kept stable -- callers only ever
    enqueue by document_version_id -- so swapping the no-op body for a real
    scan later won't touch any caller.
    """
    from app.documents.models import DocumentVersion
    from app.extensions import db

    version = DocumentVersion.query.get(document_version_id)
    if version is None:
        return
    version.virus_scan_status = "clean"
    db.session.commit()

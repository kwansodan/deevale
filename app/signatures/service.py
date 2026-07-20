import uuid

from flask import render_template_string

from app.core.model_mixins import utcnow
from app.extensions import db
from app.signatures.models import SignatureParty, SignatureRequest


def render_merged_html(body_html: str, merge_values: dict) -> str:
    """Renders a template body with the provided merge values. Autoescaping is
    on (render_template_string uses the app's Jinja env) so signer-supplied
    values can't inject markup."""
    return render_template_string(body_html, **merge_values)


def next_signer(request: SignatureRequest) -> SignatureParty | None:
    """The party whose turn it is: the lowest-order party still pending, but
    only once every earlier party has signed (sequential signing)."""
    for party in sorted(request.parties, key=lambda p: p.order_index):
        if party.status == "signed":
            continue
        return party
    return None


def can_party_sign(party: SignatureParty) -> bool:
    request = party.request
    for other in request.parties:
        if other.order_index < party.order_index and other.status != "signed":
            return False
    return party.status == "pending"


def record_signature(party: SignatureParty, signature_type: str, signature_data: str, ip: str | None) -> None:
    party.signature_type = signature_type
    party.signature_data = signature_data
    party.signed_ip = ip
    party.signed_at = utcnow()
    party.status = "signed"
    db.session.flush()


def all_signed(request: SignatureRequest) -> bool:
    return all(p.status == "signed" for p in request.parties)


def complete_request(request: SignatureRequest) -> None:
    """Marks the request completed and kicks off signed-PDF assembly. The PDF
    task attaches the document to the case and completes the linked task."""
    request.status = "completed"
    request.completed_at = utcnow()
    db.session.flush()

    from app.signatures.tasks import assemble_signed_pdf

    db.session.commit()
    assemble_signed_pdf.delay(str(request.id))


def attach_signed_document(request: SignatureRequest, s3_key: str) -> None:
    """Creates an approved vault Document from the signed PDF, links it to the
    request, and completes the request's task if there is one. Called from the
    PDF assembly task once the file exists in storage."""
    from app.documents.models import Document, DocumentVersion
    from app.workflow.enums import TaskStatus
    from app.workflow.models import CaseTask
    from app.workflow.state_machine import TaskStateMachine

    document = Document(
        id=uuid.uuid4(),
        business_case_id=request.business_case_id,
        case_task_id=request.case_task_id,
        document_type_code="constitution",
        uploaded_by_user_id=_system_uploader(request),
        is_vault=True,
        current_version_number=1,
    )
    db.session.add(document)
    db.session.flush()

    db.session.add(
        DocumentVersion(
            id=uuid.uuid4(),
            document_id=document.id,
            version_number=1,
            s3_key=s3_key,
            original_filename=f"{request.title}-signed.pdf",
            content_type="application/pdf",
            upload_status="uploaded",
            review_status="approved",
            uploaded_at=utcnow(),
        )
    )

    request.signed_document_id = document.id
    request.signed_pdf_s3_key = s3_key

    if request.case_task_id:
        task = CaseTask.query.get(request.case_task_id)
        if task is not None and task.status not in (TaskStatus.DONE.value, TaskStatus.SKIPPED.value):
            task.linked_document_id = document.id
            db.session.flush()
            TaskStateMachine.transition(task, TaskStatus.DONE, actor=None)

    db.session.commit()


def _system_uploader(request: SignatureRequest):
    """Signed documents are system-generated; attribute them to the case's
    assigned officer, or the client as a fallback."""
    from app.workflow.models import BusinessCase

    case = BusinessCase.query.get(request.business_case_id)
    return case.assigned_officer_id or case.client_id

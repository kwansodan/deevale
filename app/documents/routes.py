import uuid

from flask_jwt_extended import jwt_required
from flask_smorest import Blueprint

from app.core.audit import write_audit_log
from app.core.current_user import get_current_user
from app.core.enums import RoleName
from app.core.errors import ForbiddenError, NotFoundError, ValidationAppError
from app.core.events.bus import bus
from app.core.events.events import DocumentApproved, DocumentRejected, DocumentUploaded
from app.core.model_mixins import utcnow
from app.core.ownership import ensure_case_access
from app.documents.enums import VAULT_DOCUMENT_TYPES, ReviewStatus, UploadStatus
from app.documents.models import Document, DocumentVersion
from app.documents.schemas import (
    DocumentSchema,
    DownloadUrlResponseSchema,
    ReviewRequestSchema,
    UploadSlotRequestSchema,
    UploadSlotResponseSchema,
)
from app.documents.storage import build_s3_key, presign_get_url, presign_put_url
from app.documents.validation import validate_upload_request
from app.extensions import db
from app.workflow.models import BusinessCase

blp = Blueprint("documents", __name__, url_prefix="/documents", description="Document center endpoints")


def _get_case_or_404(case_id) -> BusinessCase:
    case = BusinessCase.query.get(case_id)
    if case is None:
        raise NotFoundError("Case not found")
    return case


def _get_document_or_404(document_id: str) -> Document:
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError:
        raise NotFoundError("Document not found") from None
    document = Document.query.get(doc_uuid)
    if document is None:
        raise NotFoundError("Document not found")
    return document


@blp.route("/upload-slot", methods=["POST"])
@jwt_required()
@blp.arguments(UploadSlotRequestSchema)
@blp.response(201, UploadSlotResponseSchema)
def request_upload_slot_route(payload):
    user = get_current_user()

    try:
        case_uuid = uuid.UUID(payload["business_case_id"])
    except ValueError:
        raise ValidationAppError("Invalid business_case_id") from None
    case = _get_case_or_404(case_uuid)
    ensure_case_access(user, case)

    validate_upload_request(payload["content_type"], payload["size_bytes"])

    if payload.get("document_id"):
        document = _get_document_or_404(payload["document_id"])
        if document.business_case_id != case.id:
            raise NotFoundError("Document not found")
        version_number = document.current_version_number + 1
    else:
        is_vault = payload["document_type_code"] in {t.value for t in VAULT_DOCUMENT_TYPES} and not user.has_role(
            RoleName.CLIENT
        )
        case_task = None
        if payload.get("case_task_id"):
            try:
                task_uuid = uuid.UUID(payload["case_task_id"])
            except ValueError:
                raise ValidationAppError("Invalid case_task_id") from None
            from app.workflow.models import CaseTask

            case_task = CaseTask.query.get(task_uuid)
            if case_task is None or case_task.case_stage.business_case_id != case.id:
                raise NotFoundError("Task not found on this case")

        document = Document(
            id=uuid.uuid4(),
            business_case_id=case.id,
            case_task_id=case_task.id if case_task else None,
            document_type_code=payload["document_type_code"],
            uploaded_by_user_id=user.id,
            is_vault=is_vault,
            current_version_number=0,
        )
        db.session.add(document)
        db.session.flush()
        if case_task is not None:
            case_task.linked_document_id = document.id
        version_number = 1

    s3_key = build_s3_key(case.id, document.id, version_number, payload["original_filename"])
    version = DocumentVersion(
        id=uuid.uuid4(),
        document_id=document.id,
        version_number=version_number,
        s3_key=s3_key,
        original_filename=payload["original_filename"],
        content_type=payload["content_type"],
        size_bytes=payload["size_bytes"],
        upload_status=UploadStatus.PENDING.value,
        review_status=ReviewStatus.PENDING_REVIEW.value,
    )
    db.session.add(version)
    document.current_version_number = version_number
    db.session.commit()

    upload_url = presign_put_url(s3_key, payload["content_type"])

    return {
        "document_id": str(document.id),
        "version_id": str(version.id),
        "version_number": version_number,
        "upload_url": upload_url,
        "s3_key": s3_key,
    }


@blp.route("/<string:document_id>/versions/<int:version_number>/confirm", methods=["POST"])
@jwt_required()
@blp.response(200, DocumentSchema)
def confirm_upload_route(document_id, version_number):
    user = get_current_user()
    document = _get_document_or_404(document_id)
    case = _get_case_or_404(document.business_case_id)
    ensure_case_access(user, case)

    version = next((v for v in document.versions if v.version_number == version_number), None)
    if version is None:
        raise NotFoundError("Document version not found")

    version.upload_status = UploadStatus.UPLOADED.value
    version.uploaded_at = utcnow()
    db.session.commit()

    from app.documents.tasks import scan_document_version

    scan_document_version.delay(str(version.id))

    if user.has_role(RoleName.CLIENT):
        bus.dispatch(DocumentUploaded(case_id=case.id, document_id=document.id))
        db.session.commit()

    return document


@blp.route("/<string:document_id>/versions/<int:version_number>/review", methods=["POST"])
@jwt_required()
@blp.arguments(ReviewRequestSchema)
@blp.response(200, DocumentSchema)
def review_document_version_route(payload, document_id, version_number):
    user = get_current_user()
    document = _get_document_or_404(document_id)
    case = _get_case_or_404(document.business_case_id)
    ensure_case_access(user, case)

    if not any(user.has_role(r) for r in (RoleName.REVIEWER, RoleName.CASE_OFFICER, RoleName.ADMIN)):
        raise ForbiddenError("Your role does not permit document review")

    version = next((v for v in document.versions if v.version_number == version_number), None)
    if version is None:
        raise NotFoundError("Document version not found")

    decision = payload["decision"]
    if decision == "approve":
        version.review_status = ReviewStatus.APPROVED.value
        version.review_reason_code = None
        version.review_note = payload.get("note")
    else:
        if not payload.get("reason_code"):
            raise ValidationAppError("A reason_code is required when rejecting a document")
        version.review_status = ReviewStatus.REJECTED.value
        version.review_reason_code = payload["reason_code"]
        version.review_note = payload.get("note")

    version.reviewed_by_user_id = user.id
    version.reviewed_at = utcnow()

    write_audit_log(
        action="document_approved" if decision == "approve" else "document_rejected",
        actor_user_id=user.id,
        entity_type="document_version",
        entity_id=version.id,
        context={"reason_code": version.review_reason_code, "note": version.review_note},
    )
    db.session.commit()

    if decision == "approve":
        bus.dispatch(DocumentApproved(case_id=case.id, document_id=document.id, task_id=document.case_task_id))
    else:
        bus.dispatch(
            DocumentRejected(
                case_id=case.id,
                document_id=document.id,
                reason_code=version.review_reason_code,
                note=version.review_note or "",
                task_id=document.case_task_id,
            )
        )
    db.session.commit()

    return document


@blp.route("/<string:document_id>/download-url", methods=["GET"])
@jwt_required()
@blp.response(200, DownloadUrlResponseSchema)
def get_download_url_route(document_id):
    user = get_current_user()
    document = _get_document_or_404(document_id)
    case = _get_case_or_404(document.business_case_id)
    ensure_case_access(user, case)

    current_version = document.current_version()
    if current_version is None:
        raise NotFoundError("This document has no uploaded versions yet")

    download_url = presign_get_url(current_version.s3_key)

    write_audit_log(
        action="document_downloaded",
        actor_user_id=user.id,
        entity_type="document",
        entity_id=document.id,
        context={"version_number": current_version.version_number},
    )
    db.session.commit()

    return {"download_url": download_url, "expires_in": 300}


@blp.route("/cases/<string:case_id>", methods=["GET"])
@jwt_required()
@blp.response(200, DocumentSchema(many=True))
def list_case_documents_route(case_id):
    user = get_current_user()
    try:
        case_uuid = uuid.UUID(case_id)
    except ValueError:
        raise NotFoundError("Case not found") from None
    case = _get_case_or_404(case_uuid)
    ensure_case_access(user, case)

    return Document.query.filter_by(business_case_id=case.id).order_by(Document.created_at.desc()).all()

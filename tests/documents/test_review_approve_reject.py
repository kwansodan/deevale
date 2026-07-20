from app.core.enums import RoleName
from app.core.models import AuditLog
from app.workflow.case_factory import CaseFactory
from app.workflow.models import CaseTask
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def _setup(email_suffix):
    seed_company_ltd_workflow()
    client_user = make_user(email=f"docreview{email_suffix}client@example.com", roles=[RoleName.CLIENT])
    officer = make_user(email=f"docreview{email_suffix}officer@example.com", roles=[RoleName.CASE_OFFICER])
    reviewer = make_user(email=f"docreview{email_suffix}reviewer@example.com", roles=[RoleName.REVIEWER])
    case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
    stage1 = min(case.stages, key=lambda s: s.sequence_order)
    filed_task = next(t for t in stage1.tasks if t.code == "orc_name_reservation_filed")
    return client_user, officer, reviewer, case, filed_task


def test_rejected_reupload_approved_loop_completes_parent_task(app, client):
    with app.app_context():
        client_user, officer, reviewer, case, filed_task = _setup("1")

        upload_resp = client.post(
            "/documents/upload-slot",
            headers=auth_headers(officer),
            json={
                "business_case_id": str(case.id),
                "case_task_id": str(filed_task.id),
                "document_type_code": "name_reservation_certificate",
                "original_filename": "reservation_v1.pdf",
                "content_type": "application/pdf",
                "size_bytes": 4096,
            },
        )
        document_id = upload_resp.get_json()["document_id"]
        client.post(f"/documents/{document_id}/versions/1/confirm", headers=auth_headers(officer))

        # Passing case_task_id at upload-slot time links the document onto the task.
        from app.extensions import db

        db.session.refresh(filed_task)
        assert str(filed_task.linked_document_id) == document_id

        reject_resp = client.post(
            f"/documents/{document_id}/versions/1/review",
            headers=auth_headers(reviewer),
            json={"decision": "reject", "reason_code": "illegible", "note": "Scan is too blurry to read."},
        )
        assert reject_resp.status_code == 200
        assert AuditLog.query.filter_by(action="document_rejected").count() == 1

        db.session.refresh(filed_task)
        assert filed_task.status == "pending"  # staff task never entered awaiting_review

        reupload_resp = client.post(
            "/documents/upload-slot",
            headers=auth_headers(officer),
            json={
                "business_case_id": str(case.id),
                "document_id": document_id,
                "document_type_code": "name_reservation_certificate",
                "original_filename": "reservation_v2.pdf",
                "content_type": "application/pdf",
                "size_bytes": 4096,
            },
        )
        assert reupload_resp.get_json()["version_number"] == 2
        client.post(f"/documents/{document_id}/versions/2/confirm", headers=auth_headers(officer))

        approve_resp = client.post(
            f"/documents/{document_id}/versions/2/review",
            headers=auth_headers(reviewer),
            json={"decision": "approve"},
        )
        assert approve_resp.status_code == 200
        assert AuditLog.query.filter_by(action="document_approved").count() == 1

        completed_task = CaseTask.query.get(filed_task.id)
        assert completed_task.status == "done"


def test_client_cannot_review_documents(app, client):
    with app.app_context():
        client_user, officer, reviewer, case, filed_task = _setup("2")

        upload_resp = client.post(
            "/documents/upload-slot",
            headers=auth_headers(officer),
            json={
                "business_case_id": str(case.id),
                "document_type_code": "name_reservation_certificate",
                "original_filename": "reservation.pdf",
                "content_type": "application/pdf",
                "size_bytes": 4096,
            },
        )
        document_id = upload_resp.get_json()["document_id"]

        resp = client.post(
            f"/documents/{document_id}/versions/1/review",
            headers=auth_headers(client_user),
            json={"decision": "approve"},
        )
        assert resp.status_code == 403


def test_reject_without_reason_code_is_rejected(app, client):
    with app.app_context():
        _, officer, reviewer, case, _ = _setup("3")

        upload_resp = client.post(
            "/documents/upload-slot",
            headers=auth_headers(officer),
            json={
                "business_case_id": str(case.id),
                "document_type_code": "name_reservation_certificate",
                "original_filename": "reservation.pdf",
                "content_type": "application/pdf",
                "size_bytes": 4096,
            },
        )
        document_id = upload_resp.get_json()["document_id"]

        resp = client.post(
            f"/documents/{document_id}/versions/1/review",
            headers=auth_headers(reviewer),
            json={"decision": "reject"},
        )
        assert resp.status_code == 422

from app.core.enums import RoleName
from app.documents.models import Document
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def _client_with_case(app, email):
    seed_company_ltd_workflow()
    client_user = make_user(email=email, roles=[RoleName.CLIENT])
    case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
    return client_user, case


def test_request_upload_slot_creates_document_and_first_version(app, client):
    with app.app_context():
        client_user, case = _client_with_case(app, "docupload1@example.com")

        resp = client.post(
            "/documents/upload-slot",
            headers=auth_headers(client_user),
            json={
                "business_case_id": str(case.id),
                "document_type_code": "passport",
                "original_filename": "passport.pdf",
                "content_type": "application/pdf",
                "size_bytes": 2048,
            },
        )
        assert resp.status_code == 201, resp.get_json()
        data = resp.get_json()
        assert data["version_number"] == 1
        assert data["upload_url"].startswith("https://fake-s3/")

        document = Document.query.get(data["document_id"])
        assert document is not None
        assert document.current_version_number == 1
        assert document.versions[0].upload_status == "pending"


def test_confirm_upload_marks_version_uploaded_and_enqueues_scan(app, client):
    with app.app_context():
        client_user, case = _client_with_case(app, "docupload2@example.com")

        slot_resp = client.post(
            "/documents/upload-slot",
            headers=auth_headers(client_user),
            json={
                "business_case_id": str(case.id),
                "document_type_code": "passport",
                "original_filename": "passport.pdf",
                "content_type": "application/pdf",
                "size_bytes": 2048,
            },
        )
        document_id = slot_resp.get_json()["document_id"]

        confirm_resp = client.post(
            f"/documents/{document_id}/versions/1/confirm", headers=auth_headers(client_user)
        )
        assert confirm_resp.status_code == 200
        document = Document.query.get(document_id)
        version = document.versions[0]
        assert version.upload_status == "uploaded"
        assert version.uploaded_at is not None
        assert version.virus_scan_status == "clean"  # stub task ran eagerly in tests


def test_staff_upload_of_deliverable_type_is_pinned_to_vault(app, client):
    with app.app_context():
        client_user, case = _client_with_case(app, "docupload4@example.com")
        officer = make_user(email="docupload4officer@example.com", roles=[RoleName.CASE_OFFICER])

        resp = client.post(
            "/documents/upload-slot",
            headers=auth_headers(officer),
            json={
                "business_case_id": str(case.id),
                "document_type_code": "certificate_of_incorporation",
                "original_filename": "cert.pdf",
                "content_type": "application/pdf",
                "size_bytes": 2048,
            },
        )
        document = Document.query.get(resp.get_json()["document_id"])
        assert document.is_vault is True


def test_client_upload_is_never_marked_vault_even_for_deliverable_type(app, client):
    with app.app_context():
        client_user, case = _client_with_case(app, "docupload5@example.com")

        resp = client.post(
            "/documents/upload-slot",
            headers=auth_headers(client_user),
            json={
                "business_case_id": str(case.id),
                "document_type_code": "certificate_of_incorporation",
                "original_filename": "cert.pdf",
                "content_type": "application/pdf",
                "size_bytes": 2048,
            },
        )
        document = Document.query.get(resp.get_json()["document_id"])
        assert document.is_vault is False


def test_other_client_cannot_request_upload_slot_for_foreign_case(app, client):
    with app.app_context():
        _, case = _client_with_case(app, "docupload3@example.com")
        other_client = make_user(email="docupload3b@example.com", roles=[RoleName.CLIENT])

        resp = client.post(
            "/documents/upload-slot",
            headers=auth_headers(other_client),
            json={
                "business_case_id": str(case.id),
                "document_type_code": "passport",
                "original_filename": "passport.pdf",
                "content_type": "application/pdf",
                "size_bytes": 2048,
            },
        )
        assert resp.status_code == 403

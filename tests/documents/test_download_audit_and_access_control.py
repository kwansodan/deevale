from app.core.enums import RoleName
from app.core.models import AuditLog
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def _case_with_uploaded_document(client, email_suffix):
    seed_company_ltd_workflow()
    client_user = make_user(email=f"docdl{email_suffix}@example.com", roles=[RoleName.CLIENT])
    case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
    headers = auth_headers(client_user)
    upload_resp = client.post(
        "/documents/upload-slot",
        headers=headers,
        json={
            "business_case_id": str(case.id),
            "document_type_code": "passport",
            "original_filename": "passport.pdf",
            "content_type": "application/pdf",
            "size_bytes": 2048,
        },
    )
    document_id = upload_resp.get_json()["document_id"]
    client.post(f"/documents/{document_id}/versions/1/confirm", headers=headers)
    return client_user, case, document_id


def test_owner_can_get_download_url_and_it_is_audit_logged(app, client):
    with app.app_context():
        client_user, case, document_id = _case_with_uploaded_document(client, "1")

        resp = client.get(f"/documents/{document_id}/download-url", headers=auth_headers(client_user))
        assert resp.status_code == 200
        assert resp.get_json()["download_url"].startswith("https://fake-s3/")
        assert resp.get_json()["expires_in"] == 300

        logs = AuditLog.query.filter_by(action="document_downloaded").all()
        assert len(logs) == 1
        assert logs[0].actor_user_id == client_user.id


def test_other_client_cannot_download_foreign_document(app, client):
    with app.app_context():
        _, case, document_id = _case_with_uploaded_document(client, "2")
        other_client = make_user(email="docdlother@example.com", roles=[RoleName.CLIENT])

        resp = client.get(f"/documents/{document_id}/download-url", headers=auth_headers(other_client))
        assert resp.status_code == 403


def test_staff_can_download_any_case_document(app, client):
    with app.app_context():
        _, case, document_id = _case_with_uploaded_document(client, "3")
        staff = make_user(email="docdlstaff@example.com", roles=[RoleName.CASE_OFFICER])

        resp = client.get(f"/documents/{document_id}/download-url", headers=auth_headers(staff))
        assert resp.status_code == 200


def test_client_only_sees_own_case_documents_in_list(app, client):
    with app.app_context():
        client_a, case_a, _ = _case_with_uploaded_document(client, "4a")
        client_b, case_b, _ = _case_with_uploaded_document(client, "4b")

        resp_a = client.get(f"/documents/cases/{case_a.id}", headers=auth_headers(client_a))
        assert resp_a.status_code == 200
        assert len(resp_a.get_json()) == 1

        resp_forbidden = client.get(f"/documents/cases/{case_a.id}", headers=auth_headers(client_b))
        assert resp_forbidden.status_code == 403

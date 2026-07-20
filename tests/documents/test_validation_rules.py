from app.core.enums import RoleName
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def _client_with_case(email):
    seed_company_ltd_workflow()
    client_user = make_user(email=email, roles=[RoleName.CLIENT])
    case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
    return client_user, case


def test_disallowed_content_type_rejected(app, client):
    with app.app_context():
        client_user, case = _client_with_case("docvalid1@example.com")
        resp = client.post(
            "/documents/upload-slot",
            headers=auth_headers(client_user),
            json={
                "business_case_id": str(case.id),
                "document_type_code": "passport",
                "original_filename": "malware.exe",
                "content_type": "application/x-msdownload",
                "size_bytes": 1024,
            },
        )
        assert resp.status_code == 422


def test_oversized_file_rejected(app, client):
    with app.app_context():
        client_user, case = _client_with_case("docvalid2@example.com")
        resp = client.post(
            "/documents/upload-slot",
            headers=auth_headers(client_user),
            json={
                "business_case_id": str(case.id),
                "document_type_code": "passport",
                "original_filename": "huge.pdf",
                "content_type": "application/pdf",
                "size_bytes": 11 * 1024 * 1024,
            },
        )
        assert resp.status_code == 422


def test_zero_byte_file_rejected(app, client):
    with app.app_context():
        client_user, case = _client_with_case("docvalid3@example.com")
        resp = client.post(
            "/documents/upload-slot",
            headers=auth_headers(client_user),
            json={
                "business_case_id": str(case.id),
                "document_type_code": "passport",
                "original_filename": "empty.pdf",
                "content_type": "application/pdf",
                "size_bytes": 0,
            },
        )
        assert resp.status_code == 422


def test_allowed_content_types_accepted(app, client):
    with app.app_context():
        client_user, case = _client_with_case("docvalid4@example.com")
        for content_type, filename in [
            ("application/pdf", "a.pdf"),
            ("image/jpeg", "a.jpg"),
            ("image/png", "a.png"),
        ]:
            resp = client.post(
                "/documents/upload-slot",
                headers=auth_headers(client_user),
                json={
                    "business_case_id": str(case.id),
                    "document_type_code": "proof_of_address",
                    "original_filename": filename,
                    "content_type": content_type,
                    "size_bytes": 1024,
                },
            )
            assert resp.status_code == 201, resp.get_json()

from app.core.enums import RoleName
from app.documents.models import Document
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def _upload(client, headers, case_id, document_id=None, filename="doc.pdf"):
    payload = {
        "business_case_id": str(case_id),
        "document_type_code": "passport",
        "original_filename": filename,
        "content_type": "application/pdf",
        "size_bytes": 1024,
    }
    if document_id:
        payload["document_id"] = str(document_id)
    return client.post("/documents/upload-slot", headers=headers, json=payload)


def test_reupload_creates_version_two_and_retains_version_one(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        client_user = make_user(email="docver1@example.com", roles=[RoleName.CLIENT])
        case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
        headers = auth_headers(client_user)

        first = _upload(client, headers, case.id, filename="v1.pdf")
        document_id = first.get_json()["document_id"]
        assert first.get_json()["version_number"] == 1

        second = _upload(client, headers, case.id, document_id=document_id, filename="v2.pdf")
        assert second.status_code == 201
        assert second.get_json()["version_number"] == 2
        assert second.get_json()["document_id"] == document_id

        document = Document.query.get(document_id)
        assert document.current_version_number == 2
        assert len(document.versions) == 2
        version_numbers = sorted(v.version_number for v in document.versions)
        assert version_numbers == [1, 2]
        # Prior version retained, not deleted/overwritten.
        v1 = next(v for v in document.versions if v.version_number == 1)
        assert v1.original_filename == "v1.pdf"
        v2 = next(v for v in document.versions if v.version_number == 2)
        assert v2.original_filename == "v2.pdf"


def test_reupload_by_a_client_who_does_not_own_the_case_is_rejected(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        client_a = make_user(email="docver2a@example.com", roles=[RoleName.CLIENT])
        client_b = make_user(email="docver2b@example.com", roles=[RoleName.CLIENT])
        case_a = CaseFactory.create_from_onboarding(client_a, {"entity_type": "company_limited_by_shares"})

        first = _upload(client, auth_headers(client_a), case_a.id, filename="a.pdf")
        document_id = first.get_json()["document_id"]

        # client_b references case_a's real id but isn't its owner -- ensure_case_access must deny.
        resp = _upload(client, auth_headers(client_b), case_a.id, document_id=document_id, filename="b.pdf")
        assert resp.status_code == 403


def test_reupload_referencing_document_from_another_case_is_not_found(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        client_a = make_user(email="docver3a@example.com", roles=[RoleName.CLIENT])
        client_b = make_user(email="docver3b@example.com", roles=[RoleName.CLIENT])
        case_a = CaseFactory.create_from_onboarding(client_a, {"entity_type": "company_limited_by_shares"})
        case_b = CaseFactory.create_from_onboarding(client_b, {"entity_type": "company_limited_by_shares"})

        first = _upload(client, auth_headers(client_a), case_a.id, filename="a.pdf")
        document_id = first.get_json()["document_id"]

        # client_b owns case_b but the document_id belongs to case_a -- must not resolve.
        resp = _upload(client, auth_headers(client_b), case_b.id, document_id=document_id, filename="b.pdf")
        assert resp.status_code == 404

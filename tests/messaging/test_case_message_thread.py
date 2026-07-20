from app.core.enums import RoleName
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def _case(email):
    seed_company_ltd_workflow()
    client_user = make_user(email=email, roles=[RoleName.CLIENT])
    case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
    return client_user, case


def test_client_and_officer_can_exchange_messages(app, client):
    with app.app_context():
        client_user, case = _case("msgthread1@example.com")
        officer = make_user(email="msgthread1officer@example.com", roles=[RoleName.CASE_OFFICER])

        resp1 = client.post(
            f"/cases/{case.id}/messages",
            headers=auth_headers(client_user),
            json={"body": "When will my name reservation be ready?"},
        )
        assert resp1.status_code == 201
        assert resp1.get_json()["client_read_at"] is not None
        assert resp1.get_json()["officer_read_at"] is None

        resp2 = client.post(
            f"/cases/{case.id}/messages",
            headers=auth_headers(officer),
            json={"body": "Should be ready within a week!"},
        )
        assert resp2.status_code == 201

        thread_resp = client.get(f"/cases/{case.id}/messages", headers=auth_headers(client_user))
        assert thread_resp.status_code == 200
        assert len(thread_resp.get_json()) == 2


def test_other_client_cannot_read_foreign_case_thread(app, client):
    with app.app_context():
        _, case = _case("msgthread2@example.com")
        other_client = make_user(email="msgthread2other@example.com", roles=[RoleName.CLIENT])

        resp = client.get(f"/cases/{case.id}/messages", headers=auth_headers(other_client))
        assert resp.status_code == 403


def test_mark_messages_read_updates_officer_read_at(app, client):
    with app.app_context():
        client_user, case = _case("msgthread3@example.com")
        officer = make_user(email="msgthread3officer@example.com", roles=[RoleName.CASE_OFFICER])

        client.post(
            f"/cases/{case.id}/messages", headers=auth_headers(client_user), json={"body": "Hello?"}
        )

        read_resp = client.post(f"/cases/{case.id}/messages/read", headers=auth_headers(officer))
        assert read_resp.status_code == 200
        assert all(m["officer_read_at"] is not None for m in read_resp.get_json())

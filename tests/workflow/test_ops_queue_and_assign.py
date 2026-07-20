from app.core.enums import RoleName
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def _cases(count: int, prefix: str):
    seed_company_ltd_workflow()
    cases = []
    for i in range(count):
        client_user = make_user(email=f"{prefix}{i}@example.com", roles=[RoleName.CLIENT])
        cases.append(
            CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
        )
    return cases


def test_queue_paginates(app, client):
    with app.app_context():
        _cases(5, "queuepage")
        officer = make_user(email="queueofficer@example.com", roles=[RoleName.CASE_OFFICER])

        resp = client.get("/cases/queue?page=1&page_size=2", headers=auth_headers(officer))
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] == 5
        assert len(data["items"]) == 2
        assert data["page"] == 1

        resp2 = client.get("/cases/queue?page=3&page_size=2", headers=auth_headers(officer))
        assert len(resp2.get_json()["items"]) == 1


def test_queue_filters_by_stage_code(app, client):
    with app.app_context():
        _cases(2, "queuestage")
        officer = make_user(email="queuestageofficer@example.com", roles=[RoleName.CASE_OFFICER])

        in_name_reservation = client.get(
            "/cases/queue?stage_code=name_reservation", headers=auth_headers(officer)
        )
        assert in_name_reservation.get_json()["total"] == 2

        in_tax = client.get("/cases/queue?stage_code=tax_registration", headers=auth_headers(officer))
        assert in_tax.get_json()["total"] == 0


def test_queue_denied_for_clients(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        client_user = make_user(email="queueclient@example.com", roles=[RoleName.CLIENT])
        resp = client.get("/cases/queue", headers=auth_headers(client_user))
        assert resp.status_code == 403


def test_assign_case_to_officer(app, client):
    with app.app_context():
        cases = _cases(1, "assigncase")
        officer = make_user(email="assignofficer@example.com", roles=[RoleName.CASE_OFFICER])

        resp = client.post(
            f"/cases/{cases[0].id}/assign",
            headers=auth_headers(officer),
            json={"officer_id": str(officer.id)},
        )
        assert resp.status_code == 200
        assert resp.get_json()["assigned_officer_id"] == str(officer.id)

        unassigned = client.get("/cases/queue?assigned_officer_id=unassigned", headers=auth_headers(officer))
        assert unassigned.get_json()["total"] == 0

        mine = client.get(
            f"/cases/queue?assigned_officer_id={officer.id}", headers=auth_headers(officer)
        )
        assert mine.get_json()["total"] == 1


def test_assign_rejects_non_officer_target(app, client):
    with app.app_context():
        cases = _cases(1, "assignbad")
        officer = make_user(email="assignbadofficer@example.com", roles=[RoleName.CASE_OFFICER])
        random_client = make_user(email="assignbadclient@example.com", roles=[RoleName.CLIENT])

        resp = client.post(
            f"/cases/{cases[0].id}/assign",
            headers=auth_headers(officer),
            json={"officer_id": str(random_client.id)},
        )
        assert resp.status_code == 422


def test_case_audit_log_endpoint_staff_only(app, client):
    with app.app_context():
        cases = _cases(1, "auditcase")
        officer = make_user(email="auditofficer@example.com", roles=[RoleName.CASE_OFFICER])
        client_user = make_user(email="auditclientx@example.com", roles=[RoleName.CLIENT])

        staff_resp = client.get(f"/cases/{cases[0].id}/audit-logs", headers=auth_headers(officer))
        assert staff_resp.status_code == 200
        actions = [entry["action"] for entry in staff_resp.get_json()]
        assert "case_created" in actions

        client_resp = client.get(f"/cases/{cases[0].id}/audit-logs", headers=auth_headers(client_user))
        assert client_resp.status_code == 403

from app.core.enums import RoleName
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def _create_case_via_api(client, headers):
    resp = client.post("/cases", headers=headers, json={"entity_type": "company_limited_by_shares"})
    assert resp.status_code == 201
    return resp.get_json()


def test_client_cannot_fetch_another_clients_case(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        client_a = make_user(email="httpclienta@example.com", roles=[RoleName.CLIENT])
        client_b = make_user(email="httpclientb@example.com", roles=[RoleName.CLIENT])

        case = _create_case_via_api(client, auth_headers(client_a))
        resp = client.get(f"/cases/{case['id']}", headers=auth_headers(client_b))
        assert resp.status_code == 403


def test_staff_can_fetch_any_case(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        client_a = make_user(email="httpclientc@example.com", roles=[RoleName.CLIENT])
        staff = make_user(email="httpstaffc@example.com", roles=[RoleName.REVIEWER])

        case = _create_case_via_api(client, auth_headers(client_a))
        resp = client.get(f"/cases/{case['id']}", headers=auth_headers(staff))
        assert resp.status_code == 200


def test_get_case_requires_authentication(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        client_a = make_user(email="httpclientd@example.com", roles=[RoleName.CLIENT])
        case = _create_case_via_api(client, auth_headers(client_a))

    resp = client.get(f"/cases/{case['id']}")
    assert resp.status_code == 401


def test_finance_role_denied_on_staff_task_transition(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        client_a = make_user(email="httpclientf@example.com", roles=[RoleName.CLIENT])
        finance = make_user(email="httpfinancef@example.com", roles=[RoleName.FINANCE])

        case = _create_case_via_api(client, auth_headers(client_a))
        first_stage = case["stages"][0]
        staff_task = next(t for t in first_stage["tasks"] if t["assignee_type"] == "staff")

        resp = client.post(
            f"/cases/{case['id']}/tasks/{staff_task['id']}/transition",
            headers=auth_headers(finance),
            json={"new_status": "done"},
        )
        assert resp.status_code == 403


def test_client_cannot_complete_another_clients_task(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        client_a = make_user(email="httpclienta2@example.com", roles=[RoleName.CLIENT])
        client_b = make_user(email="httpclientb2@example.com", roles=[RoleName.CLIENT])

        case = _create_case_via_api(client, auth_headers(client_a))
        first_stage = case["stages"][0]
        client_task = next(t for t in first_stage["tasks"] if t["assignee_type"] == "client")

        resp = client.post(
            f"/cases/{case['id']}/tasks/{client_task['id']}/complete",
            headers=auth_headers(client_b),
            json={},
        )
        assert resp.status_code == 403

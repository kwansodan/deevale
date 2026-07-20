from app.core.enums import RoleName
from app.notifications.copy import render_notification
from tests.helpers import auth_headers, make_user


def test_admin_can_list_templates_with_defaults(app, client):
    with app.app_context():
        admin = make_user(email="tpladmin1@example.com", roles=[RoleName.ADMIN])
        resp = client.get("/admin/notification-templates", headers=auth_headers(admin))
        assert resp.status_code == 200
        templates = resp.get_json()
        assert any(t["category"] == "action_required" for t in templates)
        assert all(t["is_override"] is False for t in templates)


def test_template_override_changes_rendered_copy_and_reset_restores(app, client):
    with app.app_context():
        admin = make_user(email="tpladmin2@example.com", roles=[RoleName.ADMIN])

        put_resp = client.put(
            "/admin/notification-templates",
            headers=auth_headers(admin),
            json={
                "category": "action_required",
                "title_template": "Heads up: {task_name}",
                "body_template": "Custom body for {business_name}.",
            },
        )
        assert put_resp.status_code == 200
        assert put_resp.get_json()["is_override"] is True

        title, body = render_notification(
            "action_required", {"task_name": "Upload passport", "business_name": "TestCo"}
        )
        assert title == "Heads up: Upload passport"
        assert body == "Custom body for TestCo."

        delete_resp = client.delete(
            "/admin/notification-templates/action_required", headers=auth_headers(admin)
        )
        assert delete_resp.status_code == 200

        title_after, _ = render_notification(
            "action_required", {"task_name": "Upload passport", "business_name": "TestCo"}
        )
        assert title_after == "Action needed: Upload passport"


def test_non_admin_cannot_manage_templates(app, client):
    with app.app_context():
        officer = make_user(email="tplofficer@example.com", roles=[RoleName.CASE_OFFICER])
        resp = client.get("/admin/notification-templates", headers=auth_headers(officer))
        assert resp.status_code == 403


def test_finance_can_manage_fee_schedule(app, client):
    with app.app_context():
        finance = make_user(email="tplfinance@example.com", roles=[RoleName.FINANCE])

        create_resp = client.post(
            "/admin/fee-schedule",
            headers=auth_headers(finance),
            json={
                "code": "TEST_ADMIN_FEE",
                "label": "Test Admin Fee",
                "amount_minor": 12_345,
                "fee_type": "government",
            },
        )
        assert create_resp.status_code == 201
        item_id = create_resp.get_json()["id"]

        update_resp = client.put(
            f"/admin/fee-schedule/{item_id}",
            headers=auth_headers(finance),
            json={"amount_minor": 20_000},
        )
        assert update_resp.status_code == 200
        assert update_resp.get_json()["amount_minor"] == 20_000

        dup_resp = client.post(
            "/admin/fee-schedule",
            headers=auth_headers(finance),
            json={
                "code": "TEST_ADMIN_FEE",
                "label": "Duplicate",
                "amount_minor": 1,
                "fee_type": "government",
            },
        )
        assert dup_resp.status_code == 409

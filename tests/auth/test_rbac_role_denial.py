import pytest
from flask import jsonify

from app.core.enums import RoleName
from app.core.rbac import require_roles
from tests.helpers import auth_headers, make_user


@pytest.fixture(scope="module", autouse=True)
def admin_only_test_route(app):
    """Registers a throwaway route guarded by @require_roles so the RBAC
    decorator itself can be exercised end-to-end (through real JWT
    verification) without depending on any specific domain's endpoints.
    """

    @require_roles(RoleName.ADMIN, RoleName.FINANCE)
    def _admin_or_finance_only():
        return jsonify({"ok": True})

    endpoint = "admin_or_finance_only_test_route"
    if endpoint not in app.view_functions:
        app.add_url_rule("/__test__/admin-or-finance", endpoint, _admin_or_finance_only, methods=["GET"])
    yield


def test_role_with_permission_is_allowed(client):
    user = make_user(email="rbacadmin@example.com", roles=[RoleName.ADMIN])
    resp = client.get("/__test__/admin-or-finance", headers=auth_headers(user))
    assert resp.status_code == 200


def test_role_without_permission_is_denied(client):
    user = make_user(email="rbacclient@example.com", roles=[RoleName.CLIENT])
    resp = client.get("/__test__/admin-or-finance", headers=auth_headers(user))
    assert resp.status_code == 403


def test_unauthenticated_request_is_denied(client):
    resp = client.get("/__test__/admin-or-finance")
    assert resp.status_code == 401


def test_one_of_multiple_allowed_roles_is_sufficient(client):
    user = make_user(email="rbacfinance@example.com", roles=[RoleName.FINANCE])
    resp = client.get("/__test__/admin-or-finance", headers=auth_headers(user))
    assert resp.status_code == 200

import pytest

from app.core.enums import RoleName
from app.core.errors import ForbiddenError
from app.core.ownership import ensure_case_access
from tests.helpers import make_bare_case, make_user


def test_owner_client_can_access_own_case(app):
    with app.app_context():
        client_a = make_user(email="clienta@example.com", roles=[RoleName.CLIENT])
        case = make_bare_case(client_a)
        ensure_case_access(client_a, case)  # must not raise


def test_other_client_cannot_access_case(app):
    with app.app_context():
        client_a = make_user(email="clienta2@example.com", roles=[RoleName.CLIENT])
        client_b = make_user(email="clientb2@example.com", roles=[RoleName.CLIENT])
        case = make_bare_case(client_a)

        with pytest.raises(ForbiddenError):
            ensure_case_access(client_b, case)


@pytest.mark.parametrize(
    "role",
    [RoleName.CASE_OFFICER, RoleName.REVIEWER, RoleName.FINANCE, RoleName.ADMIN],
)
def test_any_staff_role_can_access_any_case(app, role):
    with app.app_context():
        client_a = make_user(email=f"clientfor{role.value}@example.com", roles=[RoleName.CLIENT])
        staff = make_user(email=f"staff{role.value}@example.com", roles=[role])
        case = make_bare_case(client_a)
        ensure_case_access(staff, case)  # must not raise

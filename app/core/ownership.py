from app.core.enums import RoleName
from app.core.errors import ForbiddenError


def ensure_case_access(user, case) -> None:
    """The single enforcement point for case-scoped access control.

    Every case-scoped endpoint must call this (after loading the case) before
    doing anything else. Clients may only access their own case; any staff
    role (case_officer/reviewer/finance/admin) may access any case -- the
    internal team isn't siloed by assignment, `assigned_officer_id` only
    affects notification routing / queue filters.
    """
    if user.has_role(RoleName.CLIENT):
        if case.client_id != user.id:
            raise ForbiddenError("You do not have access to this case")
        return

    staff_roles = {RoleName.CASE_OFFICER, RoleName.REVIEWER, RoleName.FINANCE, RoleName.ADMIN}
    if any(user.has_role(r) for r in staff_roles):
        return

    raise ForbiddenError("You do not have access to this case")

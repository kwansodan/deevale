from functools import wraps

from flask_jwt_extended import get_jwt, verify_jwt_in_request

from app.core.enums import RoleName
from app.core.errors import ForbiddenError


def require_roles(*roles: RoleName):
    """Restricts an endpoint to users holding at least one of the given roles.

    Roles are read from the access token's claims (embedded at login time),
    not re-fetched from the DB, to avoid a query on every request -- acceptable
    given the short 15 minute access token lifetime.
    """
    allowed = {r.value for r in roles}

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_roles = set(claims.get("roles", []))
            if not user_roles & allowed:
                raise ForbiddenError("Your role does not permit this action")
            return fn(*args, **kwargs)

        return wrapper

    return decorator

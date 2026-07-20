import uuid

from flask_jwt_extended import get_jwt_identity

from app.auth.models import User


def get_current_user() -> User:
    return User.query.get(uuid.UUID(get_jwt_identity()))

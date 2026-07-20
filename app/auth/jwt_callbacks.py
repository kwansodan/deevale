from flask_jwt_extended import JWTManager

from app.auth.blocklist import is_blocklisted
from app.auth.models import User


def register_jwt_callbacks(jwt: JWTManager) -> None:
    @jwt.token_in_blocklist_loader
    def check_if_revoked(jwt_header, jwt_payload):
        return is_blocklisted(jwt_payload["jti"])

    @jwt.user_identity_loader
    def user_identity_lookup(user: "User | str"):
        return str(user.id) if isinstance(user, User) else str(user)

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        identity = jwt_data["sub"]
        return User.query.get(identity)

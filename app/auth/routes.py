import time
import uuid

from flask import request
from flask_jwt_extended import (
    decode_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from flask_smorest import Blueprint

from app.auth.blocklist import add_to_blocklist
from app.auth.models import OtpPurpose, User
from app.auth.schemas import (
    LoginSchema,
    MessageResponseSchema,
    OtpVerifySchema,
    PasswordResetConfirmSchema,
    PasswordResetRequestSchema,
    RefreshResponseSchema,
    SignupResponseSchema,
    SignupSchema,
    TokenResponseSchema,
    UserSchema,
)
from app.auth.service import (
    authenticate,
    build_tokens,
    complete_signup_verification,
    confirm_password_reset,
    request_password_reset,
    signup,
    verify_otp,
)
from app.core.audit import write_audit_log
from app.core.enums import STAFF_ROLES, RoleName
from app.core.errors import UnauthorizedError, ValidationAppError
from app.core.rbac import require_roles
from app.extensions import db, limiter

blp = Blueprint("auth", __name__, url_prefix="/auth", description="Authentication, OTP, and password reset")


@blp.route("/signup", methods=["POST"])
@blp.arguments(SignupSchema)
@blp.response(201, SignupResponseSchema)
@limiter.limit("5 per minute")
def signup_route(payload):
    user = signup(
        email=payload["email"],
        phone=payload["phone"],
        secondary_phone=payload.get("secondary_phone"),
        is_whatsapp_reachable=payload.get("is_whatsapp_reachable", False),
        full_name=payload["full_name"],
        password=payload["password"],
        referral_code=payload.get("referral_code"),
    )
    db.session.commit()
    return {"user_id": str(user.id), "message": "Signup successful. Check your email for a verification code."}


@blp.route("/verify-otp", methods=["POST"])
@blp.arguments(OtpVerifySchema)
@blp.response(200, MessageResponseSchema)
@limiter.limit("10 per minute")
def verify_otp_route(payload):
    verify_otp(identifier=payload["identifier"], code=payload["code"], purpose=OtpPurpose.SIGNUP)
    user = User.query.filter(
        (User.phone == payload["identifier"]) | (User.email == payload["identifier"])
    ).first()
    if user is None:
        raise ValidationAppError("No account found for this identifier")
    complete_signup_verification(user)
    db.session.commit()
    return {"message": "Account verified. You can now log in."}


@blp.route("/login", methods=["POST"])
@blp.arguments(LoginSchema)
@blp.response(200, TokenResponseSchema)
@limiter.limit("10 per minute")
def login_route(payload):
    user = authenticate(payload["email"], payload["password"])
    if user is None:
        write_audit_log(action="login_failed", context={"email": payload["email"]})
        db.session.commit()
        raise UnauthorizedError("Incorrect email or password")

    # Signup verification is by email now, so that is the flag that gates login.
    if not user.is_email_verified:
        raise UnauthorizedError("Please verify your account before logging in")

    tokens = build_tokens(user)
    write_audit_log(action="login_success", actor_user_id=user.id, entity_type="user", entity_id=user.id)
    db.session.commit()
    return tokens


@blp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
@blp.response(200, RefreshResponseSchema)
def refresh_route():
    user = User.query.get(uuid.UUID(get_jwt_identity()))
    if user is None or not user.is_active:
        raise UnauthorizedError("Account no longer active")

    old_jti = get_jwt()["jti"]
    old_exp = get_jwt()["exp"]
    add_to_blocklist(old_jti, expires_in_seconds=int(old_exp - time.time()))

    tokens = build_tokens(user)
    db.session.commit()
    return tokens


@blp.route("/logout", methods=["POST"])
@jwt_required()
@blp.response(200, MessageResponseSchema)
def logout_route():
    claims = get_jwt()
    add_to_blocklist(claims["jti"], expires_in_seconds=max(int(claims["exp"] - time.time()), 1))

    body = request.get_json(silent=True) or {}
    refresh_token = body.get("refresh_token")
    if refresh_token:
        try:
            decoded = decode_token(refresh_token)
            add_to_blocklist(decoded["jti"], expires_in_seconds=max(int(decoded["exp"] - time.time()), 1))
        except Exception:
            pass

    return {"message": "Logged out"}


@blp.route("/password-reset/request", methods=["POST"])
@blp.arguments(PasswordResetRequestSchema)
@blp.response(200, MessageResponseSchema)
@limiter.limit("5 per minute")
def password_reset_request_route(payload):
    user = request_password_reset(payload["email"])
    write_audit_log(
        action="password_reset_requested",
        actor_user_id=user.id if user else None,
        context={"email": payload["email"]},
    )
    db.session.commit()
    return {"message": "If an account exists for this email, a reset code has been sent."}


@blp.route("/password-reset/confirm", methods=["POST"])
@blp.arguments(PasswordResetConfirmSchema)
@blp.response(200, MessageResponseSchema)
@limiter.limit("10 per minute")
def password_reset_confirm_route(payload):
    user = confirm_password_reset(payload["email"], payload["code"], payload["new_password"])
    write_audit_log(action="password_reset_completed", actor_user_id=user.id, entity_type="user", entity_id=user.id)
    db.session.commit()
    return {"message": "Password updated. You can now log in with your new password."}


@blp.route("/me", methods=["GET"])
@jwt_required()
@blp.response(200, UserSchema)
def me_route():
    user = User.query.get(uuid.UUID(get_jwt_identity()))
    if user is None:
        raise UnauthorizedError("User not found")
    return user


@blp.route("/me/locale", methods=["PUT"])
@jwt_required()
@blp.response(200, UserSchema)
def set_locale_route():
    user = User.query.get(uuid.UUID(get_jwt_identity()))
    if user is None:
        raise UnauthorizedError("User not found")
    body = request.get_json(silent=True) or {}
    locale = body.get("locale")
    if locale not in ("en", "tw", "fr"):
        raise ValidationAppError("Unsupported locale")
    user.locale = locale
    db.session.commit()
    return user


@blp.route("/staff", methods=["GET"])
@require_roles(RoleName.CASE_OFFICER, RoleName.REVIEWER, RoleName.FINANCE, RoleName.ADMIN)
@blp.response(200, UserSchema(many=True))
def list_staff_route():
    """All users holding any staff role -- powers the quick-assign dropdown."""
    from app.auth.models import Role

    staff_role_names = [r.value for r in STAFF_ROLES]
    return (
        User.query.join(User.roles)
        .filter(Role.name.in_(staff_role_names))
        .distinct()
        .order_by(User.full_name)
        .all()
    )

import uuid
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from flask_jwt_extended import create_access_token, create_refresh_token

from app.auth.models import OtpChannel, OtpCode, OtpPurpose, Role, User
from app.auth.otp import generate_otp_code, get_otp_sender
from app.core.enums import RoleName
from app.core.errors import ConflictError, ValidationAppError
from app.core.model_mixins import utcnow
from app.extensions import db

_ph = PasswordHasher()

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def _hash_code(code: str) -> str:
    return _ph.hash(code)


def _verify_code(code_hash: str, code: str) -> bool:
    try:
        return _ph.verify(code_hash, code)
    except VerifyMismatchError:
        return False


def get_or_create_role(name: RoleName) -> Role:
    role = Role.query.filter_by(name=name.value).first()
    if role is None:
        role = Role(name=name.value)
        db.session.add(role)
        db.session.flush()
    return role


def signup(email: str, phone: str, full_name: str, password: str, referral_code: str | None = None) -> User:
    if User.query.filter_by(email=email).first() is not None:
        raise ConflictError("An account with this email already exists")
    if User.query.filter_by(phone=phone).first() is not None:
        raise ConflictError("An account with this phone number already exists")

    user = User(
        id=uuid.uuid4(),
        email=email,
        phone=phone,
        full_name=full_name,
        password_hash=hash_password(password),
        is_active=True,
        is_email_verified=False,
        is_phone_verified=False,
    )
    user.roles.append(get_or_create_role(RoleName.CLIENT))
    db.session.add(user)
    db.session.flush()

    if referral_code:
        from app.referrals.service import link_referral

        link_referral(user, referral_code)

    issue_otp(identifier=phone, purpose=OtpPurpose.SIGNUP, channel=OtpChannel.SMS, user_id=user.id)
    return user


def issue_otp(identifier: str, purpose: OtpPurpose, channel: OtpChannel, user_id: uuid.UUID | None = None) -> OtpCode:
    code = generate_otp_code()
    otp = OtpCode(
        user_id=user_id,
        identifier=identifier,
        purpose=purpose.value,
        channel=channel.value,
        code_hash=_hash_code(code),
        expires_at=utcnow() + timedelta(minutes=OTP_TTL_MINUTES),
    )
    db.session.add(otp)
    db.session.flush()

    sender = get_otp_sender()
    if channel == OtpChannel.SMS:
        sender.send_sms(identifier, code)
    else:
        sender.send_email(identifier, code)
    return otp


def _latest_otp(identifier: str, purpose: OtpPurpose) -> OtpCode | None:
    return (
        OtpCode.query.filter_by(identifier=identifier, purpose=purpose.value)
        .order_by(OtpCode.created_at.desc())
        .first()
    )


def verify_otp(identifier: str, code: str, purpose: OtpPurpose) -> OtpCode:
    otp = _latest_otp(identifier, purpose)
    if otp is None or otp.is_consumed():
        raise ValidationAppError("No pending verification code found for this identifier")
    if otp.is_expired():
        raise ValidationAppError("This code has expired, request a new one")
    if otp.attempt_count >= OTP_MAX_ATTEMPTS:
        raise ValidationAppError("Too many attempts, request a new code")

    otp.attempt_count += 1
    if not _verify_code(otp.code_hash, code):
        db.session.flush()
        raise ValidationAppError("Incorrect code")

    otp.consumed_at = utcnow()
    db.session.flush()
    return otp


def complete_signup_verification(user: User) -> None:
    user.is_phone_verified = True
    user.is_email_verified = True
    db.session.flush()


def request_password_reset(email: str) -> User | None:
    user = User.query.filter_by(email=email).first()
    if user is None:
        # Do not reveal account existence -- caller returns a generic message either way.
        return None
    issue_otp(identifier=email, purpose=OtpPurpose.PASSWORD_RESET, channel=OtpChannel.EMAIL, user_id=user.id)
    return user


def confirm_password_reset(email: str, code: str, new_password: str) -> User:
    user = User.query.filter_by(email=email).first()
    if user is None:
        raise ValidationAppError("Invalid code")
    verify_otp(identifier=email, code=code, purpose=OtpPurpose.PASSWORD_RESET)
    user.password_hash = hash_password(new_password)
    db.session.flush()
    return user


def authenticate(email: str, password: str) -> User | None:
    user = User.query.filter_by(email=email).first()
    if user is None or not user.is_active:
        return None
    if not verify_password(user.password_hash, password):
        return None
    return user


def build_tokens(user: User) -> dict:
    claims = {"roles": user.role_names()}
    access_token = create_access_token(identity=user, additional_claims=claims)
    refresh_token = create_refresh_token(identity=user, additional_claims=claims)
    return {"access_token": access_token, "refresh_token": refresh_token}

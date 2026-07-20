import uuid

from flask import current_app
from flask_jwt_extended import jwt_required
from flask_smorest import Blueprint

from app.core.current_user import get_current_user
from app.core.errors import ForbiddenError, NotFoundError, ValidationAppError
from app.core.model_mixins import utcnow
from app.core.ownership import ensure_case_access
from app.documents.storage import build_s3_key, presign_put_url
from app.documents.validation import validate_upload_request
from app.extensions import db
from app.referrals.models import CoFounderInvite, ReferralCredit
from app.referrals.schemas import (
    CoFounderInviteCreateSchema,
    CoFounderInviteSchema,
    KycSlotRequestSchema,
    KycSlotResponseSchema,
    PublicInviteSchema,
    ReferralMeSchema,
)
from app.referrals.service import available_balance_minor, get_or_create_code
from app.workflow.models import BusinessCase

blp = Blueprint("referrals", __name__, url_prefix="/referrals", description="Referral program & co-founder invites")


def _case_or_404(case_id) -> BusinessCase:
    try:
        case = BusinessCase.query.get(uuid.UUID(str(case_id)))
    except ValueError:
        raise NotFoundError("Case not found") from None
    if case is None:
        raise NotFoundError("Case not found")
    return case


@blp.route("/me", methods=["GET"])
@jwt_required()
@blp.response(200, ReferralMeSchema)
def referral_me_route():
    user = get_current_user()
    code = get_or_create_code(user.id)
    db.session.commit()
    credits = (
        ReferralCredit.query.filter_by(user_id=user.id).order_by(ReferralCredit.created_at.desc()).all()
    )
    frontend = current_app.config["CORS_ORIGINS"][0]
    return {
        "code": code.code,
        "share_url": f"{frontend}/signup?ref={code.code}",
        "available_balance_minor": available_balance_minor(user.id),
        "currency": "GHS",
        "credits": credits,
    }


# --- Co-founder invites ------------------------------------------------------


@blp.route("/cases/<string:case_id>/cofounder-invites", methods=["POST"])
@jwt_required()
@blp.arguments(CoFounderInviteCreateSchema)
@blp.response(201, CoFounderInviteSchema)
def invite_cofounder_route(payload, case_id):
    user = get_current_user()
    case = _case_or_404(case_id)
    ensure_case_access(user, case)

    existing = CoFounderInvite.query.filter_by(
        business_case_id=case.id, invitee_email=payload["invitee_email"]
    ).first()
    if existing is not None:
        raise ValidationAppError("You've already invited this person to this case.")

    invite = CoFounderInvite(
        business_case_id=case.id,
        inviter_id=user.id,
        invitee_name=payload["invitee_name"],
        invitee_email=payload["invitee_email"],
        role=payload.get("role", "director"),
    )
    db.session.add(invite)
    db.session.commit()

    from app.notifications.channels.email import get_email_sender

    frontend = current_app.config["CORS_ORIGINS"][0]
    link = f"{frontend}/cofounder/{invite.token}"
    business_name = (case.onboarding_payload or {}).get("business_name", case.case_number)
    body = (
        f"{user.full_name} has invited you to join {business_name} as {invite.role}. "
        f"Create your account and complete your details here: {link}"
    )
    get_email_sender().send(
        invite.invitee_email,
        f"You're invited to join {business_name}",
        f"<p>{body}</p>",
        body,
    )
    return invite


@blp.route("/cases/<string:case_id>/cofounder-invites", methods=["GET"])
@jwt_required()
@blp.response(200, CoFounderInviteSchema(many=True))
def list_cofounder_invites_route(case_id):
    user = get_current_user()
    case = _case_or_404(case_id)
    ensure_case_access(user, case)
    return CoFounderInvite.query.filter_by(business_case_id=case.id).order_by(CoFounderInvite.created_at).all()


def _invite_by_token(token: str) -> CoFounderInvite:
    invite = CoFounderInvite.query.filter_by(token=token).first()
    if invite is None:
        raise NotFoundError("Invite not found")
    return invite


@blp.route("/cofounder-invite/<string:token>", methods=["GET"])
@blp.response(200, PublicInviteSchema)
def public_invite_route(token):
    from app.auth.models import User

    invite = _invite_by_token(token)
    case = BusinessCase.query.get(invite.business_case_id)
    inviter = User.query.get(invite.inviter_id)
    return {
        "invitee_name": invite.invitee_name,
        "inviter_name": inviter.full_name if inviter else "A colleague",
        "business_name": (case.onboarding_payload or {}).get("business_name", case.case_number) if case else "",
        "role": invite.role,
        "status": invite.status,
    }


@blp.route("/cofounder-invite/<string:token>/accept", methods=["POST"])
@jwt_required()
@blp.response(200, CoFounderInviteSchema)
def accept_invite_route(token):
    """The invitee, signed in on their OWN account, accepts. They're linked to
    the case as a co-owner and can then complete their own KYC."""
    user = get_current_user()
    invite = _invite_by_token(token)
    if invite.status == "accepted":
        raise ValidationAppError("This invite has already been accepted.")

    invite.status = "accepted"
    invite.accepted_user_id = user.id
    invite.accepted_at = utcnow()

    # Record the co-owner on the case payload so staff see who's involved.
    case = BusinessCase.query.get(invite.business_case_id)
    owners = list((case.onboarding_payload or {}).get("owners", []))
    owners.append(
        {
            "full_name": user.full_name,
            "role": invite.role,
            "nationality": "ghanaian",
            "cofounder_user_id": str(user.id),
        }
    )
    case.onboarding_payload = {**(case.onboarding_payload or {}), "owners": owners}

    # Reward the inviter with a co-founder credit.
    db.session.add(
        ReferralCredit(
            user_id=invite.inviter_id,
            amount_minor=current_app.config["REFERRAL_WELCOME_MINOR"],
            source="cofounder",
        )
    )
    db.session.commit()
    return invite


@blp.route("/cofounder-invite/<string:token>/kyc-slot", methods=["POST"])
@jwt_required()
@blp.arguments(KycSlotRequestSchema)
@blp.response(201, KycSlotResponseSchema)
def cofounder_kyc_slot_route(payload, token):
    """The accepted co-founder uploads their own ID against the case. Access is
    granted by the accepted invite (not general case ownership)."""
    user = get_current_user()
    invite = _invite_by_token(token)
    if invite.status != "accepted" or invite.accepted_user_id != user.id:
        raise ForbiddenError("You must accept this invite on your own account first.")
    validate_upload_request(payload["content_type"], payload["size_bytes"])

    from app.documents.enums import ReviewStatus, UploadStatus
    from app.documents.models import Document, DocumentVersion

    document = Document(
        id=uuid.uuid4(),
        business_case_id=invite.business_case_id,
        document_type_code=payload.get("document_type_code", "ghana_card"),
        uploaded_by_user_id=user.id,
        current_version_number=1,
    )
    db.session.add(document)
    db.session.flush()

    s3_key = build_s3_key(invite.business_case_id, document.id, 1, payload["original_filename"])
    db.session.add(
        DocumentVersion(
            id=uuid.uuid4(),
            document_id=document.id,
            version_number=1,
            s3_key=s3_key,
            original_filename=payload["original_filename"],
            content_type=payload["content_type"],
            size_bytes=payload["size_bytes"],
            upload_status=UploadStatus.PENDING.value,
            review_status=ReviewStatus.PENDING_REVIEW.value,
        )
    )
    db.session.commit()
    return {
        "document_id": str(document.id),
        "upload_url": presign_put_url(s3_key, payload["content_type"]),
        "s3_key": s3_key,
    }

import re

from app.core.enums import RoleName
from app.core.events.bus import bus
from app.core.events.events import PaymentReceived
from app.extensions import db
from app.payments.invoice_service import create_invoice_from_case
from app.referrals.models import CoFounderInvite, ReferralCredit
from app.referrals.service import available_balance_minor
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user

CODE_RE = re.compile(r"code is (\d{6})")


def _case_for(client_user):
    return CaseFactory.create_from_onboarding(
        client_user, {"entity_type": "company_limited_by_shares", "business_name": "Ref Co"}
    )


def test_get_my_referral_code_and_share_url(app, client):
    with app.app_context():
        user = make_user(email="ref-me@example.com", roles=[RoleName.CLIENT])
        resp = client.get("/referrals/me", headers=auth_headers(user))
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["code"]) == 8
        assert data["code"] in data["share_url"]
        assert data["available_balance_minor"] == 0


def test_signup_with_referral_grants_reward_on_first_payment(app, client, caplog):
    with app.app_context():
        seed_company_ltd_workflow()
        referrer = make_user(email="ref-owner@example.com", roles=[RoleName.CLIENT])
        code = client.get("/referrals/me", headers=auth_headers(referrer)).get_json()["code"]

        # New user signs up with the referral code.
        with caplog.at_level("INFO", logger="deevalegh.otp"):
            signup = client.post(
                "/auth/signup",
                json={
                    "email": "referred@example.com",
                    "phone": "0244555666",
                    "full_name": "Referred User",
                    "password": "referredpass1",
                    "referral_code": code,
                },
            )
        assert signup.status_code == 201

        from app.auth.models import User

        referred = User.query.filter_by(email="referred@example.com").one()
        case = _case_for(referred)
        db.session.commit()

        # No reward until first payment.
        assert available_balance_minor(referrer.id) == 0

        bus.dispatch(PaymentReceived(case_id=case.id, invoice_id=case.id, payment_id=case.id))
        db.session.commit()

        # Referrer earned the referral reward; referee got a welcome credit.
        assert available_balance_minor(referrer.id) == app.config["REFERRAL_REWARD_MINOR"]
        assert available_balance_minor(referred.id) == app.config["REFERRAL_WELCOME_MINOR"]

        # A second payment doesn't double-reward.
        bus.dispatch(PaymentReceived(case_id=case.id, invoice_id=case.id, payment_id=case.id))
        db.session.commit()
        assert available_balance_minor(referrer.id) == app.config["REFERRAL_REWARD_MINOR"]


def test_credits_applied_to_invoice_reduce_total(app):
    with app.app_context():
        seed_company_ltd_workflow()
        from app.workflow.enums import FeeType
        from app.workflow.models import FeeScheduleItem

        db.session.add(
            FeeScheduleItem(
                code="REF_SVC", label="Service", applies_to_entity_type="company_limited_by_shares",
                amount_minor=100_000, fee_type=FeeType.SERVICE.value,
            )
        )
        db.session.commit()

        client_user = make_user(email="ref-credit@example.com", roles=[RoleName.CLIENT])
        db.session.add(ReferralCredit(user_id=client_user.id, amount_minor=30_000, source="welcome"))
        db.session.commit()

        case = _case_for(client_user)
        db.session.commit()
        invoice = create_invoice_from_case(case)

        # 100,000 service fee minus a 30,000 credit = 70,000 payable.
        assert invoice.total_minor == 70_000
        assert any(li.amount_minor == -30_000 for li in invoice.line_items)
        assert available_balance_minor(client_user.id) == 0  # credit consumed


def test_referral_self_code_is_ignored(app, client, caplog):
    with app.app_context():
        user = make_user(email="ref-self@example.com", roles=[RoleName.CLIENT])
        code = client.get("/referrals/me", headers=auth_headers(user)).get_json()["code"]
        # Signing up a brand-new user with someone else's code links; but the
        # owner can't refer themselves (no Referral row would grant to self).
        from app.referrals.models import Referral
        from app.referrals.service import link_referral

        link_referral(user, code)  # self-reference
        db.session.commit()
        assert Referral.query.filter_by(referred_user_id=user.id).count() == 0


# --- Co-founder invites ------------------------------------------------------


def test_cofounder_invite_accept_and_own_kyc(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        owner = make_user(email="cf-owner@example.com", roles=[RoleName.CLIENT])
        case = _case_for(owner)
        db.session.commit()

        # Owner invites a co-founder.
        invite_resp = client.post(
            f"/referrals/cases/{case.id}/cofounder-invites",
            headers=auth_headers(owner),
            json={"invitee_name": "Kojo Director", "invitee_email": "kojo-cf@example.com", "role": "director"},
        )
        assert invite_resp.status_code == 201

        invite = CoFounderInvite.query.filter_by(business_case_id=case.id).one()

        # Public invite view works without auth.
        public = client.get(f"/referrals/cofounder-invite/{invite.token}")
        assert public.status_code == 200
        assert public.get_json()["business_name"] == "Ref Co"

        # The co-founder signs up on their OWN account and accepts.
        cofounder = make_user(email="kojo-cf@example.com", roles=[RoleName.CLIENT])
        accept = client.post(
            f"/referrals/cofounder-invite/{invite.token}/accept", headers=auth_headers(cofounder)
        )
        assert accept.status_code == 200
        assert CoFounderInvite.query.get(invite.id).status == "accepted"

        # Inviter earned a co-founder credit.
        assert available_balance_minor(owner.id) == app.config["REFERRAL_WELCOME_MINOR"]

        # The co-founder can now upload their own KYC against the case.
        slot = client.post(
            f"/referrals/cofounder-invite/{invite.token}/kyc-slot",
            headers=auth_headers(cofounder),
            json={"original_filename": "id.jpg", "content_type": "image/jpeg", "size_bytes": 2048},
        )
        assert slot.status_code == 201
        assert slot.get_json()["upload_url"].startswith("https://fake-s3/")

        # Owners list now includes the co-founder.
        db.session.refresh(case)
        assert any(o.get("cofounder_user_id") == str(cofounder.id) for o in case.onboarding_payload["owners"])


def test_kyc_slot_denied_before_acceptance(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        owner = make_user(email="cf-owner2@example.com", roles=[RoleName.CLIENT])
        case = _case_for(owner)
        db.session.commit()
        client.post(
            f"/referrals/cases/{case.id}/cofounder-invites",
            headers=auth_headers(owner),
            json={"invitee_name": "X", "invitee_email": "x-cf@example.com"},
        )
        invite = CoFounderInvite.query.filter_by(business_case_id=case.id).one()
        stranger = make_user(email="stranger@example.com", roles=[RoleName.CLIENT])
        resp = client.post(
            f"/referrals/cofounder-invite/{invite.token}/kyc-slot",
            headers=auth_headers(stranger),
            json={"original_filename": "id.jpg", "content_type": "image/jpeg", "size_bytes": 2048},
        )
        assert resp.status_code == 403

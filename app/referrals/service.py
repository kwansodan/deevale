import uuid

from flask import current_app

from app.extensions import db
from app.referrals.models import Referral, ReferralCode, ReferralCredit


def get_or_create_code(user_id) -> ReferralCode:
    code = ReferralCode.query.filter_by(user_id=user_id).first()
    if code is None:
        code = ReferralCode(user_id=user_id)
        db.session.add(code)
        db.session.flush()
    return code


def available_balance_minor(user_id) -> int:
    credits = ReferralCredit.query.filter_by(user_id=user_id, status="available").all()
    return sum(c.amount_minor for c in credits)


def link_referral(referred_user, code: str | None) -> None:
    """Called at signup. Records who referred the new user (no reward yet --
    that lands when their first invoice is paid)."""
    if not code:
        return
    referral_code = ReferralCode.query.filter_by(code=code.strip().upper()).first()
    if referral_code is None or referral_code.user_id == referred_user.id:
        return
    if Referral.query.filter_by(referred_user_id=referred_user.id).first() is not None:
        return
    db.session.add(Referral(referrer_id=referral_code.user_id, referred_user_id=referred_user.id))
    db.session.flush()


def grant_referral_rewards(referred_user_id) -> bool:
    """Called on the referred user's first payment.received. Grants the
    referrer a reward credit and the referee a welcome credit, once."""
    referral = Referral.query.filter_by(referred_user_id=referred_user_id, rewarded=False).first()
    if referral is None:
        return False
    db.session.add(
        ReferralCredit(
            user_id=referral.referrer_id,
            amount_minor=current_app.config["REFERRAL_REWARD_MINOR"],
            source="referral",
        )
    )
    db.session.add(
        ReferralCredit(
            user_id=referral.referred_user_id,
            amount_minor=current_app.config["REFERRAL_WELCOME_MINOR"],
            source="welcome",
        )
    )
    referral.rewarded = True
    db.session.flush()
    return True


def apply_credits_to_invoice(invoice) -> int:
    """Applies the client's available credits against an invoice, up to its
    total. Returns the discount applied (minor units). Adds a negative line
    item and marks the consumed credits 'applied'. Cash-basis, append-only --
    a real ledger could reconcile these later."""
    from app.payments.models import InvoiceLineItem

    client_id = invoice.business_case.client_id if invoice.business_case else None
    if client_id is None:
        from app.workflow.models import BusinessCase

        case = BusinessCase.query.get(invoice.business_case_id)
        client_id = case.client_id if case else None
    if client_id is None:
        return 0

    credits = (
        ReferralCredit.query.filter_by(user_id=client_id, status="available")
        .order_by(ReferralCredit.created_at)
        .all()
    )
    remaining = invoice.total_minor
    applied_total = 0
    for credit in credits:
        if remaining <= 0:
            break
        # Partial application isn't split here; a credit is only consumed whole
        # if it fits. Keeps the ledger simple; leftover stays available.
        if credit.amount_minor <= remaining:
            credit.status = "applied"
            credit.applied_invoice_id = invoice.id
            remaining -= credit.amount_minor
            applied_total += credit.amount_minor

    if applied_total > 0:
        max_seq = max((li.sequence_order for li in invoice.line_items), default=-1)
        db.session.add(
            InvoiceLineItem(
                id=uuid.uuid4(),
                invoice_id=invoice.id,
                label="Referral credit",
                amount_minor=-applied_total,
                fee_type="service",
                sequence_order=max_seq + 1,
            )
        )
        invoice.total_minor -= applied_total
        invoice.subtotal_service_minor = max(invoice.subtotal_service_minor - applied_total, 0)
        db.session.flush()
    return applied_total

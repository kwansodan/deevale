from app.core.events.bus import DomainEventBus


def handle_payment_received(event) -> None:
    """Grants the referrer their reward when a referred client's first invoice
    is paid."""
    from app.extensions import db
    from app.referrals.service import grant_referral_rewards
    from app.workflow.models import BusinessCase

    case = BusinessCase.query.get(event.case_id)
    if case is None:
        return
    if grant_referral_rewards(case.client_id):
        db.session.flush()


def register(bus: DomainEventBus) -> None:
    bus.register("payment.received", handle_payment_received)

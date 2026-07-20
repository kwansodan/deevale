import hashlib
import hmac
import json

from app.extensions import db
from app.partners.models import PartnerWebhook, PartnerWebhookDelivery


def sign_payload(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def dispatch_case_event(event_type: str, case_id, payload: dict) -> int:
    """Queues signed webhook deliveries to every active partner webhook that
    (a) belongs to the case's partner and (b) subscribes to this event type.
    Returns the number of deliveries queued."""
    from app.workflow.models import BusinessCase

    case = BusinessCase.query.get(case_id)
    if case is None or case.partner_id is None:
        return 0

    webhooks = PartnerWebhook.query.filter_by(partner_id=case.partner_id, is_active=True).all()
    delivery_ids = []
    for webhook in webhooks:
        if event_type not in (webhook.event_types or []):
            continue
        delivery = PartnerWebhookDelivery(
            webhook_id=webhook.id,
            event_type=event_type,
            payload={"event": event_type, "case_id": str(case_id), "data": payload},
        )
        db.session.add(delivery)
        db.session.flush()
        delivery_ids.append(str(delivery.id))

    if delivery_ids:
        db.session.commit()
        from app.partners.tasks import deliver_webhook

        for delivery_id in delivery_ids:
            deliver_webhook.delay(delivery_id)
    return len(delivery_ids)


def delivery_body(delivery: PartnerWebhookDelivery) -> bytes:
    return json.dumps(delivery.payload, separators=(",", ":")).encode()

from app.celery_app import celery_app

MAX_ATTEMPTS = 6


@celery_app.task(
    name="app.partners.tasks.deliver_webhook",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=3600,
    max_retries=MAX_ATTEMPTS,
)
def deliver_webhook(self, delivery_id: str) -> None:
    """POSTs a signed webhook payload to the partner's URL. Retries with
    exponential backoff on failure; marks abandoned after MAX_ATTEMPTS."""
    import requests

    from app.core.model_mixins import utcnow
    from app.extensions import db
    from app.partners.models import PartnerWebhook, PartnerWebhookDelivery
    from app.partners.webhooks import delivery_body, sign_payload

    delivery = PartnerWebhookDelivery.query.get(delivery_id)
    if delivery is None or delivery.status == "delivered":
        return
    webhook = PartnerWebhook.query.get(delivery.webhook_id)
    if webhook is None or not webhook.is_active:
        delivery.status = "abandoned"
        db.session.commit()
        return

    body = delivery_body(delivery)
    signature = sign_payload(webhook.secret, body)
    delivery.attempts += 1

    try:
        response = requests.post(
            webhook.url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "X-Deevale-Event": delivery.event_type,
                "X-Deevale-Signature": signature,
                "X-Deevale-Delivery": str(delivery.id),
            },
            timeout=15,
        )
        delivery.response_code = response.status_code
        response.raise_for_status()
    except Exception as exc:
        delivery.last_error = str(exc)[:500]
        delivery.status = "abandoned" if delivery.attempts >= MAX_ATTEMPTS else "failed"
        delivery.next_retry_at = utcnow()
        db.session.commit()
        raise

    delivery.status = "delivered"
    db.session.commit()

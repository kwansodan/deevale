import json

from app.core.enums import RoleName
from app.payments.models import Payment, PaymentEvent
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user
from tests.payments.conftest import sign_paystack_payload


def test_duplicate_webhook_delivery_is_processed_only_once(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        client_user = make_user(email="webhookidem1@example.com", roles=[RoleName.CLIENT])
        case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})

        invoice_id = client.post(
            f"/payments/cases/{case.id}/invoice", headers=auth_headers(client_user)
        ).get_json()["id"]
        init_resp = client.post(
            f"/payments/invoices/{invoice_id}/initialize-transaction", headers=auth_headers(client_user)
        )
        provider_reference = init_resp.get_json()["provider_reference"]

        from app.payments.models import Invoice

        invoice = Invoice.query.get(invoice_id)
        secret = app.config["PAYSTACK_SECRET_KEY"]
        payload = {
            "event": "charge.success",
            "data": {
                "reference": provider_reference,
                "status": "success",
                "amount": invoice.total_minor,
                "channel": "mobile_money",
            },
        }
        raw_body, signature = sign_paystack_payload(payload, secret)
        headers = {"Content-Type": "application/json", "x-paystack-signature": signature}

        first_resp = client.post("/payments/webhook/paystack", data=raw_body, headers=headers)
        assert first_resp.status_code == 200
        assert first_resp.get_json()["message"] == "processed"

        second_resp = client.post("/payments/webhook/paystack", data=raw_body, headers=headers)
        assert second_resp.status_code == 200
        assert second_resp.get_json()["message"] == "already processed"

        assert PaymentEvent.query.filter_by(provider="paystack").count() == 1
        successful_payments = Payment.query.filter_by(
            provider_reference=provider_reference, status="success"
        ).all()
        assert len(successful_payments) == 1

        invoice = Invoice.query.get(invoice_id)
        assert invoice.status == "paid"

        from app.payments.tasks import generate_receipt_pdf

        assert generate_receipt_pdf.delay.call_count == 1


def test_webhook_for_failed_charge_marks_invoice_failed(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        client_user = make_user(email="webhookidem2@example.com", roles=[RoleName.CLIENT])
        case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})

        invoice_id = client.post(
            f"/payments/cases/{case.id}/invoice", headers=auth_headers(client_user)
        ).get_json()["id"]
        init_resp = client.post(
            f"/payments/invoices/{invoice_id}/initialize-transaction", headers=auth_headers(client_user)
        )
        provider_reference = init_resp.get_json()["provider_reference"]

        secret = app.config["PAYSTACK_SECRET_KEY"]
        payload = {
            "event": "charge.failed",
            "data": {"reference": provider_reference, "status": "failed", "amount": 1000, "channel": "card"},
        }
        raw_body = json.dumps(payload).encode("utf-8")
        import hashlib
        import hmac

        signature = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha512).hexdigest()

        resp = client.post(
            "/payments/webhook/paystack",
            data=raw_body,
            headers={"Content-Type": "application/json", "x-paystack-signature": signature},
        )
        assert resp.status_code == 200

        from app.payments.models import Invoice

        assert Invoice.query.get(invoice_id).status == "failed"

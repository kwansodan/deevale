from app.core.enums import RoleName
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user
from tests.payments.conftest import sign_paystack_payload


def _initialized_invoice(app, client, email):
    seed_company_ltd_workflow()
    client_user = make_user(email=email, roles=[RoleName.CLIENT])
    case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
    invoice_id = client.post(
        f"/payments/cases/{case.id}/invoice", headers=auth_headers(client_user)
    ).get_json()["id"]
    init_resp = client.post(
        f"/payments/invoices/{invoice_id}/initialize-transaction", headers=auth_headers(client_user)
    )
    provider_reference = init_resp.get_json()["provider_reference"]
    return case, invoice_id, provider_reference


def test_webhook_with_valid_signature_is_accepted(app, client):
    with app.app_context():
        case, invoice_id, provider_reference = _initialized_invoice(app, client, "webhooksig1@example.com")
        from app.payments.models import Invoice

        invoice = Invoice.query.get(invoice_id)
        secret = app.config["PAYSTACK_SECRET_KEY"]

        payload = {
            "event": "charge.success",
            "data": {
                "reference": provider_reference,
                "status": "success",
                "amount": invoice.total_minor,
                "channel": "card",
            },
        }
        raw_body, signature = sign_paystack_payload(payload, secret)

        resp = client.post(
            "/payments/webhook/paystack",
            data=raw_body,
            headers={"Content-Type": "application/json", "x-paystack-signature": signature},
        )
        assert resp.status_code == 200
        assert resp.get_json()["message"] == "processed"


def test_webhook_with_invalid_signature_is_rejected(app, client):
    with app.app_context():
        _, _, provider_reference = _initialized_invoice(app, client, "webhooksig2@example.com")

        payload = {
            "event": "charge.success",
            "data": {"reference": provider_reference, "status": "success", "amount": 1000, "channel": "card"},
        }
        import json

        raw_body = json.dumps(payload).encode("utf-8")

        resp = client.post(
            "/payments/webhook/paystack",
            data=raw_body,
            headers={"Content-Type": "application/json", "x-paystack-signature": "not-a-valid-signature"},
        )
        assert resp.status_code == 400


def test_webhook_with_missing_signature_header_is_rejected(app, client):
    with app.app_context():
        _, _, provider_reference = _initialized_invoice(app, client, "webhooksig3@example.com")
        import json

        payload = {
            "event": "charge.success",
            "data": {"reference": provider_reference, "status": "success", "amount": 1000, "channel": "card"},
        }
        resp = client.post(
            "/payments/webhook/paystack",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 400

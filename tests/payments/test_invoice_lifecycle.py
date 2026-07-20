from app.core.enums import RoleName
from app.payments.models import Invoice
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def _case(email):
    seed_company_ltd_workflow()
    client_user = make_user(email=email, roles=[RoleName.CLIENT])
    case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
    return client_user, case


def test_create_invoice_from_case_quote(app, client):
    with app.app_context():
        client_user, case = _case("invlifecycle1@example.com")

        resp = client.post(f"/payments/cases/{case.id}/invoice", headers=auth_headers(client_user))
        assert resp.status_code == 201, resp.get_json()
        data = resp.get_json()
        assert data["status"] == "sent"
        assert data["total_minor"] == case.quote.total_minor
        assert len(data["line_items"]) == len(case.quote.line_items)


def test_creating_invoice_twice_is_idempotent(app, client):
    with app.app_context():
        client_user, case = _case("invlifecycle2@example.com")

        first = client.post(f"/payments/cases/{case.id}/invoice", headers=auth_headers(client_user))
        second = client.post(f"/payments/cases/{case.id}/invoice", headers=auth_headers(client_user))
        assert first.get_json()["id"] == second.get_json()["id"]
        assert Invoice.query.filter_by(business_case_id=case.id).count() == 1


def test_initialize_transaction_returns_checkout_url_and_creates_payment(app, client):
    with app.app_context():
        client_user, case = _case("invlifecycle3@example.com")
        invoice_id = client.post(
            f"/payments/cases/{case.id}/invoice", headers=auth_headers(client_user)
        ).get_json()["id"]

        resp = client.post(
            f"/payments/invoices/{invoice_id}/initialize-transaction", headers=auth_headers(client_user)
        )
        assert resp.status_code == 200
        assert resp.get_json()["authorization_url"].startswith("https://paystack.test/checkout/")


def test_cannot_initialize_transaction_for_already_paid_invoice(app, client):
    with app.app_context():
        from app.core.model_mixins import utcnow
        from app.extensions import db
        from app.payments.enums import InvoiceStatus

        client_user, case = _case("invlifecycle4@example.com")
        invoice_id = client.post(
            f"/payments/cases/{case.id}/invoice", headers=auth_headers(client_user)
        ).get_json()["id"]

        invoice = Invoice.query.get(invoice_id)
        invoice.status = InvoiceStatus.PAID.value
        invoice.paid_at = utcnow()
        db.session.commit()

        resp = client.post(
            f"/payments/invoices/{invoice_id}/initialize-transaction", headers=auth_headers(client_user)
        )
        assert resp.status_code == 422


def test_other_client_cannot_create_invoice_for_foreign_case(app, client):
    with app.app_context():
        _, case = _case("invlifecycle5@example.com")
        other_client = make_user(email="invlifecycle5b@example.com", roles=[RoleName.CLIENT])

        resp = client.post(f"/payments/cases/{case.id}/invoice", headers=auth_headers(other_client))
        assert resp.status_code == 403

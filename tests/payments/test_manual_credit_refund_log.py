from app.core.enums import RoleName
from app.payments.models import Invoice
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def _invoice(app, client, email):
    seed_company_ltd_workflow()
    client_user = make_user(email=email, roles=[RoleName.CLIENT])
    case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
    invoice_id = client.post(
        f"/payments/cases/{case.id}/invoice", headers=auth_headers(client_user)
    ).get_json()["id"]
    return case, invoice_id


def test_finance_can_record_manual_credit_and_it_marks_invoice_paid(app, client):
    with app.app_context():
        case, invoice_id = _invoice(app, client, "manualcredit1@example.com")
        finance = make_user(email="manualcredit1finance@example.com", roles=[RoleName.FINANCE])
        invoice = Invoice.query.get(invoice_id)

        resp = client.post(
            f"/payments/finance/invoices/{invoice_id}/manual-credit",
            headers=auth_headers(finance),
            json={"amount_minor": invoice.total_minor, "note": "Bank transfer received"},
        )
        assert resp.status_code == 201
        assert resp.get_json()["is_manual_credit"] is True

        assert Invoice.query.get(invoice_id).status == "paid"


def test_partial_manual_credit_does_not_mark_invoice_paid(app, client):
    with app.app_context():
        case, invoice_id = _invoice(app, client, "manualcredit2@example.com")
        finance = make_user(email="manualcredit2finance@example.com", roles=[RoleName.FINANCE])
        invoice = Invoice.query.get(invoice_id)

        resp = client.post(
            f"/payments/finance/invoices/{invoice_id}/manual-credit",
            headers=auth_headers(finance),
            json={"amount_minor": invoice.total_minor // 2, "note": "Partial payment"},
        )
        assert resp.status_code == 201
        assert Invoice.query.get(invoice_id).status != "paid"


def test_client_cannot_access_finance_endpoints(app, client):
    with app.app_context():
        case, invoice_id = _invoice(app, client, "manualcredit3@example.com")
        client_user = make_user(email="manualcredit3client@example.com", roles=[RoleName.CLIENT])

        resp = client.get("/payments/finance/payments", headers=auth_headers(client_user))
        assert resp.status_code == 403

        resp2 = client.post(
            f"/payments/finance/invoices/{invoice_id}/manual-credit",
            headers=auth_headers(client_user),
            json={"amount_minor": 1000},
        )
        assert resp2.status_code == 403


def test_finance_can_record_refund_log(app, client):
    with app.app_context():
        case, invoice_id = _invoice(app, client, "manualcredit4@example.com")
        finance = make_user(email="manualcredit4finance@example.com", roles=[RoleName.FINANCE])
        invoice = Invoice.query.get(invoice_id)

        resp = client.post(
            f"/payments/finance/invoices/{invoice_id}/refund-log",
            headers=auth_headers(finance),
            json={"amount_minor": invoice.total_minor, "note": "Refunded via Paystack dashboard"},
        )
        assert resp.status_code == 201
        assert resp.get_json()["status"] == "refunded"
        assert Invoice.query.get(invoice_id).status == "refunded"


def test_finance_can_list_payments(app, client):
    with app.app_context():
        case, invoice_id = _invoice(app, client, "manualcredit5@example.com")
        finance = make_user(email="manualcredit5finance@example.com", roles=[RoleName.FINANCE])
        invoice = Invoice.query.get(invoice_id)

        client.post(
            f"/payments/finance/invoices/{invoice_id}/manual-credit",
            headers=auth_headers(finance),
            json={"amount_minor": invoice.total_minor},
        )

        resp = client.get("/payments/finance/payments", headers=auth_headers(finance))
        assert resp.status_code == 200
        assert len(resp.get_json()) >= 1

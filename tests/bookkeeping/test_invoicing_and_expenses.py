from datetime import UTC, date, datetime

from freezegun import freeze_time

from app.bookkeeping.models import ClientInvoice, Expense
from app.core.enums import RoleName
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def _case(email):
    seed_company_ltd_workflow()
    client_user = make_user(email=email, roles=[RoleName.CLIENT])
    case = CaseFactory.create_from_onboarding(
        client_user, {"entity_type": "company_limited_by_shares", "business_name": "Trader Ltd"}
    )
    return client_user, case


def _invoice_payload(**overrides):
    payload = {
        "customer_name": "Kwesi Retail",
        "customer_email": "kwesi@example.com",
        "currency": "GHS",
        "vat_rate_bps": 1500,
        "line_items": [
            {"description": "Consulting", "quantity_milli": 2000, "unit_price_minor": 50_000},
            {"description": "Setup fee", "quantity_milli": 1000, "unit_price_minor": 20_000},
        ],
    }
    payload.update(overrides)
    return payload


def test_create_invoice_computes_totals_and_vat(app, client):
    with app.app_context():
        client_user, case = _case("bk-inv1@example.com")
        resp = client.post(
            f"/bookkeeping/cases/{case.id}/invoices",
            headers=auth_headers(client_user),
            json=_invoice_payload(),
        )
        assert resp.status_code == 201, resp.get_json()
        data = resp.get_json()
        # 2 * 500.00 + 1 * 200.00 = 1200.00 subtotal; 15% VAT = 180.00.
        assert data["subtotal_minor"] == 120_000
        assert data["vat_minor"] == 18_000
        assert data["total_minor"] == 138_000
        assert data["status"] == "draft"
        assert data["invoice_number"].startswith("INV-")
        assert len(data["line_items"]) == 2


def test_no_vat_when_rate_zero(app, client):
    with app.app_context():
        client_user, case = _case("bk-inv2@example.com")
        resp = client.post(
            f"/bookkeeping/cases/{case.id}/invoices",
            headers=auth_headers(client_user),
            json=_invoice_payload(vat_rate_bps=0),
        )
        assert resp.get_json()["vat_minor"] == 0
        assert resp.get_json()["total_minor"] == 120_000


def test_invoice_lifecycle_draft_sent_paid_and_share_link(app, client, monkeypatch):
    with app.app_context():
        from unittest.mock import MagicMock

        monkeypatch.setattr("app.bookkeeping.tasks.generate_invoice_pdf.delay", MagicMock())

        client_user, case = _case("bk-life@example.com")
        created = client.post(
            f"/bookkeeping/cases/{case.id}/invoices",
            headers=auth_headers(client_user),
            json=_invoice_payload(),
        ).get_json()
        invoice_id = created["id"]

        # Draft: no share token yet.
        assert created["share_token"] is None

        sent = client.post(f"/bookkeeping/invoices/{invoice_id}/send", headers=auth_headers(client_user))
        assert sent.status_code == 200
        token = sent.get_json()["share_token"]
        assert token is not None
        assert sent.get_json()["status"] == "sent"

        # Public share link works with no auth and hides internal fields.
        public = client.get(f"/bookkeeping/invoices/shared/{token}")
        assert public.status_code == 200
        pub = public.get_json()
        assert pub["business_name"] == "Trader Ltd"
        assert pub["total_minor"] == 138_000
        assert "customer_email" not in pub

        paid = client.post(f"/bookkeeping/invoices/{invoice_id}/mark-paid", headers=auth_headers(client_user))
        assert paid.get_json()["status"] == "paid"


def test_draft_share_token_not_publicly_viewable(app, client):
    with app.app_context():
        client_user, case = _case("bk-draft@example.com")
        created = client.post(
            f"/bookkeeping/cases/{case.id}/invoices",
            headers=auth_headers(client_user),
            json=_invoice_payload(),
        ).get_json()
        # Manually give it a token but keep draft status.
        from app.extensions import db

        invoice = ClientInvoice.query.get(created["id"])
        invoice.share_token = "draft-token"
        db.session.commit()

        resp = client.get("/bookkeeping/invoices/shared/draft-token")
        assert resp.status_code == 404


def test_sent_invoice_cannot_be_edited(app, client, monkeypatch):
    with app.app_context():
        from unittest.mock import MagicMock

        monkeypatch.setattr("app.bookkeeping.tasks.generate_invoice_pdf.delay", MagicMock())
        client_user, case = _case("bk-edit@example.com")
        created = client.post(
            f"/bookkeeping/cases/{case.id}/invoices",
            headers=auth_headers(client_user),
            json=_invoice_payload(),
        ).get_json()
        client.post(f"/bookkeeping/invoices/{created['id']}/send", headers=auth_headers(client_user))

        resp = client.put(
            f"/bookkeeping/invoices/{created['id']}",
            headers=auth_headers(client_user),
            json=_invoice_payload(customer_name="Changed"),
        )
        assert resp.status_code == 422


def test_other_client_cannot_see_invoices(app, client):
    with app.app_context():
        _, case = _case("bk-iso@example.com")
        intruder = make_user(email="bk-intruder@example.com", roles=[RoleName.CLIENT])
        resp = client.get(f"/bookkeeping/cases/{case.id}/invoices", headers=auth_headers(intruder))
        assert resp.status_code == 403


def test_overdue_scanner_flips_past_due_sent_invoices(app):
    with app.app_context():
        from app.bookkeeping.tasks import mark_overdue_invoices
        from app.extensions import db

        client_user, case = _case("bk-overdue@example.com")
        invoice = ClientInvoice(
            business_case_id=case.id,
            client_id=client_user.id,
            invoice_number="INV-2026-0001",
            customer_name="Late Payer",
            status="sent",
            issue_date=date(2026, 6, 1),
            due_date=date(2026, 6, 15),
            total_minor=10_000,
        )
        db.session.add(invoice)
        db.session.commit()

        with freeze_time(datetime(2026, 7, 1, tzinfo=UTC)):
            flipped = mark_overdue_invoices.run()
        assert flipped == 1
        assert ClientInvoice.query.get(invoice.id).status == "overdue"


# --- Expenses & reports ------------------------------------------------------


def test_expense_capture_and_receipt_slot(app, client):
    with app.app_context():
        client_user, case = _case("bk-exp@example.com")
        created = client.post(
            f"/bookkeeping/cases/{case.id}/expenses",
            headers=auth_headers(client_user),
            json={
                "description": "Office rent",
                "category": "rent",
                "amount_minor": 200_000,
                "expense_date": "2026-07-05",
            },
        )
        assert created.status_code == 201
        expense_id = created.get_json()["id"]
        assert created.get_json()["has_receipt"] is False

        slot = client.post(
            f"/bookkeeping/expenses/{expense_id}/receipt-slot",
            headers=auth_headers(client_user),
            json={"original_filename": "receipt.jpg", "content_type": "image/jpeg", "size_bytes": 2048},
        )
        assert slot.status_code == 201
        assert slot.get_json()["upload_url"].startswith("https://fake-s3/")
        assert Expense.query.get(expense_id).receipt_s3_key is not None


def test_invalid_expense_category_rejected(app, client):
    with app.app_context():
        client_user, case = _case("bk-expbad@example.com")
        resp = client.post(
            f"/bookkeeping/cases/{case.id}/expenses",
            headers=auth_headers(client_user),
            json={
                "description": "X",
                "category": "not_a_real_category",
                "amount_minor": 100,
                "expense_date": "2026-07-05",
            },
        )
        assert resp.status_code == 422


def test_monthly_report_income_vs_expense_and_vat(app, client):
    with app.app_context():
        from app.core.model_mixins import utcnow
        from app.extensions import db

        client_user, case = _case("bk-report@example.com")
        headers = auth_headers(client_user)

        # A paid invoice in July with VAT.
        inv = ClientInvoice(
            business_case_id=case.id,
            client_id=client_user.id,
            invoice_number="INV-2026-0009",
            customer_name="Buyer",
            status="paid",
            issue_date=date(2026, 7, 1),
            paid_at=datetime(2026, 7, 10, tzinfo=UTC),
            subtotal_minor=100_000,
            vat_minor=15_000,
            total_minor=115_000,
        )
        db.session.add(inv)
        # Two July expenses.
        db.session.add_all(
            [
                Expense(
                    business_case_id=case.id, client_id=client_user.id, description="Rent",
                    category="rent", amount_minor=40_000, expense_date=date(2026, 7, 3), created_at=utcnow(),
                ),
                Expense(
                    business_case_id=case.id, client_id=client_user.id, description="Data",
                    category="telecoms", amount_minor=5_000, expense_date=date(2026, 7, 20), created_at=utcnow(),
                ),
            ]
        )
        db.session.commit()

        report = client.get(f"/bookkeeping/cases/{case.id}/report?year=2026", headers=headers).get_json()
        july = report["months"][6]  # index 6 == month 7
        assert july["income_minor"] == 100_000
        assert july["expense_minor"] == 45_000
        assert july["vat_collected_minor"] == 15_000
        assert report["total_vat_collected_minor"] == 15_000
        assert report["total_income_minor"] == 100_000

        csv_resp = client.get(f"/bookkeeping/cases/{case.id}/export.csv", headers=headers)
        assert csv_resp.status_code == 200
        assert csv_resp.mimetype == "text/csv"
        assert b"invoice" in csv_resp.data and b"expense" in csv_resp.data

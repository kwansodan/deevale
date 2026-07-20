from datetime import timedelta

import pytest

from app.billing.models import Subscription
from app.compliance.models import ComplianceObligation, ServiceRequest
from app.compliance.service import generate_obligations
from app.core.enums import RoleName
from app.core.model_mixins import utcnow
from app.extensions import db
from app.workflow.case_factory import CaseFactory
from app.workflow.workflow_library import seed_all_entity_workflows
from tests.helpers import auth_headers, make_user


def _completed_case(email, entity_type, extra_payload=None):
    seed_all_entity_workflows()
    client_user = make_user(email=email, roles=[RoleName.CLIENT])
    payload = {"entity_type": entity_type, "business_name": "Oblig Ltd", **(extra_payload or {})}
    case = CaseFactory.create_from_onboarding(client_user, payload)
    case.status = "completed"
    db.session.commit()
    return client_user, case


@pytest.mark.parametrize(
    ("entity_type", "extra", "expected_codes", "absent_codes"),
    [
        (
            "company_limited_by_shares",
            {"planned_employees": 0},
            {"orc_annual_return", "financial_statements", "corporate_income_tax", "bop_renewal"},
            {"vat_return", "paye_remittance"},
        ),
        (
            "company_limited_by_shares",
            {"planned_employees": 5, "vat_registered": True},
            {
                "orc_annual_return",
                "financial_statements",
                "corporate_income_tax",
                "bop_renewal",
                "vat_return",
                "paye_remittance",
            },
            set(),
        ),
        (
            "partnership",
            {"planned_employees": 0},
            {"orc_annual_return", "corporate_income_tax", "bop_renewal"},
            {"financial_statements", "vat_return"},
        ),
        (
            "external_company",
            {"planned_employees": 2},
            {"orc_annual_return", "financial_statements", "corporate_income_tax", "bop_renewal", "paye_remittance"},
            {"vat_return"},
        ),
    ],
)
def test_obligation_generation_matrix(app, entity_type, extra, expected_codes, absent_codes):
    with app.app_context():
        _, case = _completed_case(f"oblig-{entity_type}-{len(extra)}@example.com", entity_type, extra)
        generate_obligations(case)

        codes = {o.code for o in ComplianceObligation.query.filter_by(business_case_id=case.id).all()}
        assert expected_codes <= codes
        assert not (absent_codes & codes)


def test_obligation_generation_is_idempotent(app):
    with app.app_context():
        _, case = _completed_case("obligidem@example.com", "company_limited_by_shares")
        first = generate_obligations(case)
        assert len(first) > 0
        second = generate_obligations(case)
        assert second == []
        total = ComplianceObligation.query.filter_by(business_case_id=case.id).count()
        assert total == len(first)


def test_monthly_obligations_materialize_a_horizon(app):
    with app.app_context():
        _, case = _completed_case(
            "obligmonthly@example.com", "company_limited_by_shares", {"vat_registered": True}
        )
        generate_obligations(case)
        vat_rows = ComplianceObligation.query.filter_by(business_case_id=case.id, code="vat_return").all()
        assert len(vat_rows) == 6
        assert len({o.due_date for o in vat_rows}) == 6  # distinct months


def test_file_it_for_me_requires_active_subscription(app, client):
    with app.app_context():
        client_user, case = _completed_case("entitle1@example.com", "company_limited_by_shares")
        generate_obligations(case)
        db.session.commit()
        obligation = ComplianceObligation.query.filter_by(business_case_id=case.id).first()

        denied = client.post(
            f"/compliance/obligations/{obligation.id}/file-request", headers=auth_headers(client_user)
        )
        assert denied.status_code == 403
        assert "compliance plan" in denied.get_json()["message"]

        db.session.add(
            Subscription(
                user_id=client_user.id,
                plan="monthly",
                status="active",
                provider_reference="SUB-test",
                current_period_end=utcnow() + timedelta(days=20),
            )
        )
        db.session.commit()

        allowed = client.post(
            f"/compliance/obligations/{obligation.id}/file-request", headers=auth_headers(client_user)
        )
        assert allowed.status_code == 201
        assert ServiceRequest.query.filter_by(obligation_id=obligation.id).count() == 1

        duplicate = client.post(
            f"/compliance/obligations/{obligation.id}/file-request", headers=auth_headers(client_user)
        )
        assert duplicate.status_code == 422


def test_expired_subscription_does_not_entitle(app, client):
    with app.app_context():
        client_user, case = _completed_case("entitle2@example.com", "company_limited_by_shares")
        generate_obligations(case)
        db.session.add(
            Subscription(
                user_id=client_user.id,
                plan="monthly",
                status="active",
                provider_reference="SUB-expired",
                current_period_end=utcnow() - timedelta(days=1),
            )
        )
        db.session.commit()
        obligation = ComplianceObligation.query.filter_by(business_case_id=case.id).first()

        resp = client.post(
            f"/compliance/obligations/{obligation.id}/file-request", headers=auth_headers(client_user)
        )
        assert resp.status_code == 403


def test_calendar_visible_without_subscription_and_cross_client_isolated(app, client):
    with app.app_context():
        client_a, case_a = _completed_case("entitle3a@example.com", "company_limited_by_shares")
        client_b, _case_b = _completed_case("entitle3b@example.com", "partnership")
        generate_obligations(case_a)
        db.session.commit()

        mine = client.get("/compliance/obligations", headers=auth_headers(client_a))
        assert mine.status_code == 200
        assert len(mine.get_json()) > 0

        theirs = client.get("/compliance/obligations", headers=auth_headers(client_b))
        assert all(o["business_case_id"] != str(case_a.id) for o in theirs.get_json())


def test_service_request_flow_completes_obligation(app, client):
    with app.app_context():
        client_user, case = _completed_case("entitle4@example.com", "company_limited_by_shares")
        generate_obligations(case)
        db.session.add(
            Subscription(
                user_id=client_user.id, plan="annual", status="active",
                provider_reference="SUB-flow", current_period_end=utcnow() + timedelta(days=300),
            )
        )
        db.session.commit()
        obligation = ComplianceObligation.query.filter_by(business_case_id=case.id).first()

        created = client.post(
            f"/compliance/obligations/{obligation.id}/file-request", headers=auth_headers(client_user)
        ).get_json()

        officer = make_user(email="entitle4officer@example.com", roles=[RoleName.CASE_OFFICER])
        queue = client.get("/compliance/service-requests", headers=auth_headers(officer))
        assert any(r["id"] == created["id"] for r in queue.get_json())

        done = client.post(
            f"/compliance/service-requests/{created['id']}/transition",
            headers=auth_headers(officer),
            json={"status": "done", "note": "Filed at ORC"},
        )
        assert done.status_code == 200
        db.session.expire_all()
        assert ComplianceObligation.query.get(obligation.id).status == "completed"

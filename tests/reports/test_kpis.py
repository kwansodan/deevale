from datetime import UTC, date, datetime

from freezegun import freeze_time

from app.core.enums import RoleName
from app.reports.service import compute_kpis
from app.reports.tasks import materialize_report_snapshot
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user

TODAY = datetime(2026, 7, 20, 12, 0, tzinfo=UTC)


def test_kpis_counts_cases_and_requires_finance_or_admin(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        with freeze_time(TODAY):
            for i in range(3):
                user = make_user(email=f"kpi{i}@example.com")
                CaseFactory.create_from_onboarding(user, {"entity_type": "company_limited_by_shares"})

            finance = make_user(email="kpifinance@example.com", roles=[RoleName.FINANCE])
            officer = make_user(email="kpiofficer@example.com", roles=[RoleName.CASE_OFFICER])

            resp = client.get(
                "/reports/kpis?date_from=2026-07-14&date_to=2026-07-20", headers=auth_headers(finance)
            )
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["cases_created"] == 3
            assert data["cases_completed"] == 0
            assert len(data["daily_series"]) == 7

            denied = client.get("/reports/kpis", headers=auth_headers(officer))
            assert denied.status_code == 403


def test_snapshot_materialization_matches_live_counters(app):
    with app.app_context():
        seed_company_ltd_workflow()
        with freeze_time(TODAY):
            user = make_user(email="kpisnap@example.com")
            CaseFactory.create_from_onboarding(user, {"entity_type": "company_limited_by_shares"})

        materialize_report_snapshot.run(day_iso="2026-07-20")

        from app.reports.models import ReportSnapshot

        snapshot = ReportSnapshot.query.filter_by(snapshot_date=date(2026, 7, 20)).one()
        assert snapshot.payload["cases_created"] == 1

        # Re-running upserts rather than duplicating.
        materialize_report_snapshot.run(day_iso="2026-07-20")
        assert ReportSnapshot.query.filter_by(snapshot_date=date(2026, 7, 20)).count() == 1

        with freeze_time(datetime(2026, 8, 30, 12, 0, tzinfo=UTC)):
            kpis = compute_kpis(date(2026, 7, 1), date(2026, 8, 29))  # wide range -> snapshot path
        assert kpis["cases_created"] == 1


def test_csv_export_endpoints(app, client):
    with app.app_context():
        finance = make_user(email="kpicsv@example.com", roles=[RoleName.FINANCE])
        resp = client.get(
            "/reports/export/cases.csv?date_from=2026-07-14&date_to=2026-07-15",
            headers=auth_headers(finance),
        )
        assert resp.status_code == 200
        assert resp.mimetype == "text/csv"
        assert b"cases_created" in resp.data

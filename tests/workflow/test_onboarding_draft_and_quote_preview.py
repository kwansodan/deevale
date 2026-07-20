from app.core.enums import RoleName
from app.workflow.models import OnboardingDraft
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def test_quote_preview_returns_itemized_fees_without_creating_anything(app, client):
    with app.app_context():
        from app.extensions import db
        from app.workflow.enums import FeeType
        from app.workflow.models import FeeScheduleItem, Quote

        db.session.add_all(
            [
                FeeScheduleItem(
                    code="PREVIEW_GOV",
                    label="Preview Gov Fee",
                    amount_minor=5_000,
                    fee_type=FeeType.GOVERNMENT.value,
                ),
                FeeScheduleItem(
                    code="PREVIEW_SVC",
                    label="Preview Service Fee",
                    applies_to_entity_type="company_limited_by_shares",
                    amount_minor=20_000,
                    fee_type=FeeType.SERVICE.value,
                ),
            ]
        )
        db.session.commit()

        user = make_user(email="quotepreview@example.com", roles=[RoleName.CLIENT])
        resp = client.post(
            "/cases/quote-preview",
            headers=auth_headers(user),
            json={"entity_type": "company_limited_by_shares"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total_minor"] == 25_000
        assert len(data["line_items"]) == 2
        assert Quote.query.count() == 0  # preview persists nothing


def test_draft_upsert_and_fetch_roundtrip(app, client):
    with app.app_context():
        user = make_user(email="draftuser@example.com", roles=[RoleName.CLIENT])
        headers = auth_headers(user)

        empty = client.get("/cases/onboarding-draft", headers=headers)
        assert empty.status_code == 200
        assert empty.get_json()["payload"] == {}
        assert empty.get_json()["current_step"] == 1

        put1 = client.put(
            "/cases/onboarding-draft",
            headers=headers,
            json={"payload": {"nationality": "ghanaian"}, "current_step": 2},
        )
        assert put1.status_code == 200

        put2 = client.put(
            "/cases/onboarding-draft",
            headers=headers,
            json={"payload": {"nationality": "ghanaian", "sector": "it_services"}, "current_step": 3},
        )
        assert put2.status_code == 200
        assert OnboardingDraft.query.filter_by(user_id=user.id).count() == 1  # upsert, not duplicate

        fetched = client.get("/cases/onboarding-draft", headers=headers)
        assert fetched.get_json()["current_step"] == 3
        assert fetched.get_json()["payload"]["sector"] == "it_services"


def test_draft_deleted_after_case_creation(app, client):
    with app.app_context():
        seed_company_ltd_workflow()
        user = make_user(email="draftdone@example.com", roles=[RoleName.CLIENT])
        headers = auth_headers(user)

        client.put(
            "/cases/onboarding-draft",
            headers=headers,
            json={"payload": {"entity_type": "company_limited_by_shares"}, "current_step": 6},
        )
        resp = client.post("/cases", headers=headers, json={"entity_type": "company_limited_by_shares"})
        assert resp.status_code == 201
        assert OnboardingDraft.query.filter_by(user_id=user.id).count() == 0

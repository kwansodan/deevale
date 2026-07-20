from app.core.enums import RoleName
from app.extensions import db
from app.workflow.case_factory import CaseFactory
from app.workflow.enums import FeeType
from app.workflow.models import FeeScheduleItem
from app.workflow.seed_workflow_company_ltd import (
    seed_company_ltd_foreign_workflow,
    seed_company_ltd_workflow,
)
from tests.helpers import auth_headers, make_user


def _seed_both():
    seed_company_ltd_workflow()
    seed_company_ltd_foreign_workflow()


def _seed_fees():
    db.session.add_all(
        [
            FeeScheduleItem(
                code="F_ORC", label="ORC Filing", applies_to_stage_code="incorporation",
                amount_minor=30_000, fee_type=FeeType.GOVERNMENT.value,
            ),
            FeeScheduleItem(
                code="F_GIPC", label="GIPC Registration", applies_to_stage_code="gipc_registration",
                amount_minor=1_200_000, fee_type=FeeType.GOVERNMENT.value,
            ),
            FeeScheduleItem(
                code="F_SVC", label="Service Fee",
                applies_to_entity_type="company_limited_by_shares",
                amount_minor=150_000, fee_type=FeeType.SERVICE.value,
            ),
        ]
    )
    db.session.commit()


def test_foreign_case_instantiates_gipc_stage_after_incorporation(app):
    with app.app_context():
        _seed_both()
        client_user = make_user(email="gipc1@example.com")
        case = CaseFactory.create_from_onboarding(
            client_user, {"entity_type": "company_limited_by_shares", "gipc_required": True}
        )

        codes = [s.code for s in sorted(case.stages, key=lambda s: s.sequence_order)]
        assert codes == [
            "name_reservation",
            "incorporation",
            "gipc_registration",
            "tax_registration",
            "ssnit_registration",
            "business_operating_permit",
            "completed",
        ]

        gipc = next(s for s in case.stages if s.code == "gipc_registration")
        task_codes = {t.code for t in gipc.tasks}
        assert task_codes == {
            "open_corporate_bank_account",
            "equity_transfer_evidence",
            "gipc_document_pack",
            "gipc_submission_filed",
            "gipc_certificate_issued",
        }
        cert_task = next(t for t in gipc.tasks if t.code == "gipc_certificate_issued")
        assert cert_task.requires_document is True
        assert cert_task.required_document_type == "gipc_certificate"


def test_local_case_is_unaffected_by_foreign_track(app):
    with app.app_context():
        _seed_both()
        client_user = make_user(email="gipc2@example.com")
        case = CaseFactory.create_from_onboarding(
            client_user, {"entity_type": "company_limited_by_shares", "gipc_required": False}
        )
        codes = [s.code for s in case.stages]
        assert "gipc_registration" not in codes
        assert len(case.stages) == 6


def test_foreign_quote_includes_gipc_fee_local_excludes_it(app, client):
    with app.app_context():
        _seed_both()
        _seed_fees()
        user = make_user(email="gipc3@example.com", roles=[RoleName.CLIENT])
        headers = auth_headers(user)

        local = client.post(
            "/cases/quote-preview",
            headers=headers,
            json={"entity_type": "company_limited_by_shares", "foreign_participation": False},
        ).get_json()
        foreign = client.post(
            "/cases/quote-preview",
            headers=headers,
            json={"entity_type": "company_limited_by_shares", "foreign_participation": True},
        ).get_json()

        local_labels = {i["label"] for i in local["line_items"]}
        foreign_labels = {i["label"] for i in foreign["line_items"]}
        assert "GIPC Registration" not in local_labels
        assert "GIPC Registration" in foreign_labels
        assert foreign["total_minor"] == local["total_minor"] + 1_200_000


def test_persisted_quote_matches_variant(app):
    with app.app_context():
        _seed_both()
        _seed_fees()
        local_client = make_user(email="gipc4a@example.com")
        foreign_client = make_user(email="gipc4b@example.com")

        local_case = CaseFactory.create_from_onboarding(
            local_client, {"entity_type": "company_limited_by_shares"}
        )
        foreign_case = CaseFactory.create_from_onboarding(
            foreign_client, {"entity_type": "company_limited_by_shares", "gipc_required": True}
        )

        assert foreign_case.quote.total_minor == local_case.quote.total_minor + 1_200_000
        foreign_labels = {li.label for li in foreign_case.quote.line_items}
        assert "GIPC Registration" in foreign_labels


def test_foreign_flag_without_foreign_workflow_falls_back_to_standard(app):
    with app.app_context():
        seed_company_ltd_workflow()  # only the standard track exists
        client_user = make_user(email="gipc5@example.com")
        case = CaseFactory.create_from_onboarding(
            client_user, {"entity_type": "company_limited_by_shares", "gipc_required": True}
        )
        assert "gipc_registration" not in [s.code for s in case.stages]

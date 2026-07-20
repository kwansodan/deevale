import pytest

from app.workflow.case_factory import CaseFactory
from app.workflow.workflow_library import seed_all_entity_workflows
from tests.helpers import make_user


@pytest.mark.parametrize(
    ("entity_type", "expected_stage_codes", "vault_doc_type"),
    [
        (
            "partnership",
            [
                "name_reservation",
                "partnership_registration",
                "tax_registration",
                "ssnit_registration",
                "business_operating_permit",
                "completed",
            ],
            "partnership_certificate",
        ),
        (
            "company_limited_by_guarantee",
            [
                "name_reservation",
                "clg_incorporation",
                "tax_registration",
                "ssnit_registration",
                "business_operating_permit",
                "completed",
            ],
            "clg_certificate",
        ),
        (
            "external_company",
            [
                "home_documents",
                "external_registration",
                "tax_registration",
                "ssnit_registration",
                "business_operating_permit",
                "completed",
            ],
            "external_company_certificate",
        ),
    ],
)
def test_entity_type_instantiates_expected_stages(app, entity_type, expected_stage_codes, vault_doc_type):
    with app.app_context():
        seed_all_entity_workflows()
        client_user = make_user(email=f"entity-{entity_type}@example.com")
        case = CaseFactory.create_from_onboarding(client_user, {"entity_type": entity_type})

        codes = [s.code for s in sorted(case.stages, key=lambda s: s.sequence_order)]
        assert codes == expected_stage_codes

        all_doc_types = {
            t.required_document_type for s in case.stages for t in s.tasks if t.requires_document
        }
        assert vault_doc_type in all_doc_types


def test_clg_includes_higher_scrutiny_documents(app):
    with app.app_context():
        seed_all_entity_workflows()
        client_user = make_user(email="clgscrutiny@example.com")
        case = CaseFactory.create_from_onboarding(
            client_user, {"entity_type": "company_limited_by_guarantee"}
        )
        clg_stage = next(s for s in case.stages if s.code == "clg_incorporation")
        doc_types = {t.required_document_type for t in clg_stage.tasks if t.requires_document}
        assert {"executive_council_ids", "beneficial_ownership_profile", "constitution"} <= doc_types


def test_external_company_requires_notarized_home_documents_first(app):
    with app.app_context():
        seed_all_entity_workflows()
        client_user = make_user(email="externalnotarize@example.com")
        case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "external_company"})

        first_stage = min(case.stages, key=lambda s: s.sequence_order)
        assert first_stage.code == "home_documents"
        assert first_stage.status == "in_progress"  # not payment-gated, starts immediately
        doc_types = {t.required_document_type for t in first_stage.tasks}
        assert {"notarized_home_incorporation", "notarized_home_constitution", "power_of_attorney"} <= doc_types


def test_entity_specific_fees_do_not_leak_across_entity_types(app, client):
    with app.app_context():
        from app.core.enums import RoleName
        from app.extensions import db
        from app.workflow.enums import FeeType
        from app.workflow.models import FeeScheduleItem
        from tests.helpers import auth_headers

        seed_all_entity_workflows()
        db.session.add_all(
            [
                FeeScheduleItem(
                    code="X_PART", label="Partnership Filing", applies_to_stage_code="partnership_registration",
                    amount_minor=24_000, fee_type=FeeType.GOVERNMENT.value,
                ),
                FeeScheduleItem(
                    code="X_EXT", label="External Filing", applies_to_stage_code="external_registration",
                    amount_minor=650_000, fee_type=FeeType.GOVERNMENT.value,
                ),
                FeeScheduleItem(
                    code="X_NAME", label="Name Reservation", applies_to_stage_code="name_reservation",
                    amount_minor=2_500, fee_type=FeeType.GOVERNMENT.value,
                ),
            ]
        )
        db.session.commit()

        user = make_user(email="feeleak@example.com", roles=[RoleName.CLIENT])
        headers = auth_headers(user)

        partnership = client.post(
            "/cases/quote-preview", headers=headers, json={"entity_type": "partnership"}
        ).get_json()
        external = client.post(
            "/cases/quote-preview", headers=headers, json={"entity_type": "external_company"}
        ).get_json()

        partnership_labels = {i["label"] for i in partnership["line_items"]}
        external_labels = {i["label"] for i in external["line_items"]}

        assert "Partnership Filing" in partnership_labels
        assert "External Filing" not in partnership_labels
        assert "Name Reservation" in partnership_labels  # shared stage

        assert "External Filing" in external_labels
        assert "Partnership Filing" not in external_labels
        assert "Name Reservation" not in external_labels  # external cos have no name reservation

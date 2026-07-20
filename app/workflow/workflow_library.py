"""Workflow blueprints for the entity types beyond Company Limited by Shares.

Everything here is data fed into the same engine -- no engine changes were
needed. Shared stages (name reservation, tax, SSNIT, BOP, completed) are
plucked from the Company Ltd blueprint so their task codes stay identical,
which also lets entity-agnostic fee schedule rows (stage-coded, entity NULL)
apply across entity types automatically.
"""

from app.core.enums import RoleName
from app.documents.enums import DocumentTypeCode
from app.workflow.enums import AssigneeType, EntityType
from app.workflow.models import WorkflowDefinition
from app.workflow.seed_workflow_company_ltd import build_stages, seed_workflow

STAFF_TASK_ROLES = [RoleName.CASE_OFFICER.value, RoleName.ADMIN.value]


def _shared_stage(code: str, sequence_order: int) -> dict:
    stage = next(s for s in build_stages() if s["code"] == code)
    stage["sequence_order"] = sequence_order
    return stage


def build_partnership_stages() -> list[dict]:
    """Incorporated Private Partnership (Act 152)."""
    return [
        _shared_stage("name_reservation", 1),
        dict(
            code="partnership_registration",
            sla_hours=120,
            name="Partnership Registration",
            sequence_order=2,
            is_gated_by_payment=True,
            deadline_days=None,
            tasks=[
                dict(
                    code="client_submit_partner_ids",
                    name="Submit partner IDs",
                    description="Upload ID (Ghana Card or passport) for every partner.",
                    sequence_order=1,
                    assignee_type=AssigneeType.CLIENT.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.GHANA_CARD.value,
                ),
                dict(
                    code="client_submit_partnership_deed",
                    name="Submit partnership agreement",
                    description="Upload your signed partnership agreement/deed — we can share a template.",
                    sequence_order=2,
                    assignee_type=AssigneeType.CLIENT.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.PARTNERSHIP_DEED.value,
                ),
                dict(
                    code="orc_partnership_filed",
                    name="Partnership filed with ORC",
                    description="Staff manually files the partnership registration.",
                    sequence_order=3,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=False,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
                dict(
                    code="partnership_certificate_issued",
                    name="Partnership certificate issued",
                    description="Upload the issued certificate of registration.",
                    sequence_order=4,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.PARTNERSHIP_CERTIFICATE.value,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
            ],
        ),
        _shared_stage("tax_registration", 3),
        _shared_stage("ssnit_registration", 4),
        _shared_stage("business_operating_permit", 5),
        _shared_stage("completed", 6),
    ]


def build_clg_stages() -> list[dict]:
    """Company Limited by Guarantee (NGO) -- higher-scrutiny document set."""
    return [
        _shared_stage("name_reservation", 1),
        dict(
            code="clg_incorporation",
            sla_hours=120,
            name="Incorporation (Limited by Guarantee)",
            sequence_order=2,
            is_gated_by_payment=True,
            deadline_days=None,
            tasks=[
                dict(
                    code="client_submit_executive_ids",
                    name="Submit executive council IDs",
                    description=(
                        "NGOs face higher scrutiny: upload ID for every executive council member "
                        "and subscriber."
                    ),
                    sequence_order=1,
                    assignee_type=AssigneeType.CLIENT.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.EXECUTIVE_COUNCIL_IDS.value,
                ),
                dict(
                    code="client_submit_beneficial_ownership",
                    name="Submit beneficial ownership profile",
                    description="Declare who ultimately controls the organisation.",
                    sequence_order=2,
                    assignee_type=AssigneeType.CLIENT.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.BENEFICIAL_OWNERSHIP_PROFILE.value,
                ),
                dict(
                    code="client_submit_constitution_draft",
                    name="Submit your constitution",
                    description="Upload the organisation's constitution stating its objects and rules.",
                    sequence_order=3,
                    assignee_type=AssigneeType.CLIENT.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.CONSTITUTION.value,
                ),
                dict(
                    code="orc_clg_filed",
                    name="CLG incorporation filed with ORC",
                    description="Staff manually files the incorporation.",
                    sequence_order=4,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=False,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
                dict(
                    code="clg_certificate_issued",
                    name="Certificate of incorporation issued",
                    description="Upload the issued certificate.",
                    sequence_order=5,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.CLG_CERTIFICATE.value,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
            ],
        ),
        _shared_stage("tax_registration", 3),
        _shared_stage("ssnit_registration", 4),
        _shared_stage("business_operating_permit", 5),
        _shared_stage("completed", 6),
    ]


def build_external_company_stages() -> list[dict]:
    """External Company -- Ghana branch of an existing foreign entity. No name
    reservation (the branch uses the parent's name); home-country corporate
    documents must be notarized before ORC filing."""
    return [
        dict(
            code="home_documents",
            name="Home-Country Documents",
            sequence_order=1,
            is_gated_by_payment=False,
            deadline_days=None,
            tasks=[
                dict(
                    code="client_submit_notarized_home_incorporation",
                    name="Submit notarized certificate of incorporation",
                    description=(
                        "Upload your parent company's certificate of incorporation, notarized in "
                        "its home country (a notary public attests the copy is genuine)."
                    ),
                    sequence_order=1,
                    assignee_type=AssigneeType.CLIENT.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.NOTARIZED_HOME_INCORPORATION.value,
                ),
                dict(
                    code="client_submit_notarized_constitution",
                    name="Submit notarized constitution / bylaws",
                    description="Upload the parent company's constitution or bylaws, notarized.",
                    sequence_order=2,
                    assignee_type=AssigneeType.CLIENT.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.NOTARIZED_HOME_CONSTITUTION.value,
                ),
                dict(
                    code="client_submit_power_of_attorney",
                    name="Submit power of attorney for local manager",
                    description=(
                        "Upload the power of attorney appointing your local manager/representative "
                        "in Ghana."
                    ),
                    sequence_order=3,
                    assignee_type=AssigneeType.CLIENT.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.POWER_OF_ATTORNEY.value,
                ),
            ],
        ),
        dict(
            code="external_registration",
            sla_hours=120,
            name="External Company Registration",
            sequence_order=2,
            is_gated_by_payment=True,
            deadline_days=None,
            tasks=[
                dict(
                    code="orc_external_filed",
                    name="External company registration filed with ORC",
                    description="Staff manually files the branch registration.",
                    sequence_order=1,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=False,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
                dict(
                    code="external_certificate_issued",
                    name="Certificate of registration issued",
                    description="Upload the issued external company certificate.",
                    sequence_order=2,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.EXTERNAL_COMPANY_CERTIFICATE.value,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
            ],
        ),
        _shared_stage("tax_registration", 3),
        _shared_stage("ssnit_registration", 4),
        _shared_stage("business_operating_permit", 5),
        _shared_stage("completed", 6),
    ]


def seed_partnership_workflow() -> WorkflowDefinition:
    return seed_workflow(EntityType.PARTNERSHIP.value, "standard", build_partnership_stages())


def seed_clg_workflow() -> WorkflowDefinition:
    return seed_workflow(EntityType.COMPANY_LIMITED_BY_GUARANTEE.value, "standard", build_clg_stages())


def seed_external_company_workflow() -> WorkflowDefinition:
    return seed_workflow(EntityType.EXTERNAL_COMPANY.value, "standard", build_external_company_stages())


def seed_all_entity_workflows() -> None:
    from app.workflow.seed_workflow_company_ltd import (
        seed_company_ltd_foreign_workflow,
        seed_company_ltd_workflow,
    )

    seed_company_ltd_workflow()
    seed_company_ltd_foreign_workflow()
    seed_partnership_workflow()
    seed_clg_workflow()
    seed_external_company_workflow()

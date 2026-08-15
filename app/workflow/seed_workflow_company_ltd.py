from app.core.enums import RoleName
from app.documents.enums import DocumentTypeCode
from app.extensions import db
from app.workflow.enums import AssigneeType, EntityType
from app.workflow.models import StageDefinition, TaskDefinition, WorkflowDefinition

STAFF_TASK_ROLES = [RoleName.CASE_OFFICER.value, RoleName.ADMIN.value]


def build_stages() -> list[dict]:
    """The one fully-modeled Ghana workflow for Phase 1: Company Limited by
    Shares, from name reservation through to a completed case. Payment gates
    entry into Incorporation. See the plan doc for the scoping rationale."""
    return [
        dict(
            code="name_reservation",
            sla_hours=72,
            name="Name Reservation",
            sequence_order=1,
            is_gated_by_payment=False,
            deadline_days=30,
            tasks=[
                dict(
                    code="submit_proposed_names",
                    name="Submit proposed company names",
                    description="Give us 2-3 name options in order of preference.",
                    sequence_order=1,
                    assignee_type=AssigneeType.CLIENT.value,
                    is_required=True,
                    requires_document=False,
                    input_schema=[
                        {
                            "name": "name_1",
                            "label": "First choice",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g. Deevale Ventures",
                        },
                        {"name": "name_2", "label": "Second choice", "type": "text"},
                        {"name": "name_3", "label": "Third choice", "type": "text"},
                    ],
                ),
                dict(
                    code="orc_name_search",
                    name="ORC name search",
                    description="Staff manually checks name availability with the Registrar General's Department.",
                    sequence_order=2,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=False,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
                dict(
                    code="orc_name_reservation_filed",
                    name="Name reservation filed with ORC",
                    description="Upload the ORC's name reservation evidence.",
                    sequence_order=3,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.NAME_RESERVATION_CERTIFICATE.value,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
            ],
        ),
        dict(
            code="incorporation",
            sla_hours=120,
            name="Incorporation",
            sequence_order=2,
            is_gated_by_payment=True,
            deadline_days=None,
            tasks=[
                dict(
                    code="client_submit_incorporation_docs",
                    name="Submit incorporation documents",
                    description="Upload ID and proof of address for all directors/shareholders.",
                    sequence_order=1,
                    assignee_type=AssigneeType.CLIENT.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.PASSPORT.value,
                ),
                dict(
                    code="orc_incorporation_filed",
                    name="Incorporation filed with ORC",
                    description="Staff manually files the incorporation documents.",
                    sequence_order=2,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=False,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
                dict(
                    code="certificate_of_incorporation_issued",
                    name="Certificate of Incorporation issued",
                    description="Upload the issued Certificate of Incorporation.",
                    sequence_order=3,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.CERTIFICATE_OF_INCORPORATION.value,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
                dict(
                    code="form_3_issued",
                    name="Form 3 issued",
                    description="Upload the issued Form 3.",
                    sequence_order=4,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.FORM_3.value,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
                dict(
                    code="constitution_issued",
                    name="Constitution issued",
                    description="Upload the company's constitution.",
                    sequence_order=5,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.CONSTITUTION.value,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
            ],
        ),
        dict(
            code="tax_registration",
            sla_hours=72,
            name="Tax Registration",
            sequence_order=3,
            is_gated_by_payment=False,
            deadline_days=None,
            tasks=[
                dict(
                    code="client_submit_tax_info",
                    name="Submit tax registration information",
                    description="Confirm your business address for GRA registration.",
                    sequence_order=1,
                    assignee_type=AssigneeType.CLIENT.value,
                    is_required=True,
                    requires_document=False,
                ),
                dict(
                    code="gra_tin_filed",
                    name="TIN registration filed with GRA",
                    description="Staff manually registers the business with GRA.",
                    sequence_order=2,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=False,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
                dict(
                    code="tin_certificate_issued",
                    name="TIN certificate issued",
                    description="Upload the issued TIN certificate.",
                    sequence_order=3,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.TIN_CERTIFICATE.value,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
            ],
        ),
        dict(
            code="ssnit_registration",
            sla_hours=72,
            name="SSNIT Registration",
            sequence_order=4,
            is_gated_by_payment=False,
            deadline_days=None,
            tasks=[
                dict(
                    code="client_submit_employee_data",
                    name="Submit employee data",
                    description="Tell us about employees to register with SSNIT (skip if none planned).",
                    sequence_order=1,
                    assignee_type=AssigneeType.CLIENT.value,
                    is_required=True,
                    requires_document=False,
                ),
                dict(
                    code="ssnit_registration_filed",
                    name="SSNIT registration filed",
                    description="Staff manually registers the business with SSNIT.",
                    sequence_order=2,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=False,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
                dict(
                    code="ssnit_certificate_issued",
                    name="SSNIT certificate issued",
                    description="Upload the issued SSNIT certificate.",
                    sequence_order=3,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.SSNIT_CERTIFICATE.value,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
            ],
        ),
        dict(
            code="business_operating_permit",
            sla_hours=120,
            name="Business Operating Permit",
            sequence_order=5,
            is_gated_by_payment=False,
            deadline_days=None,
            tasks=[
                dict(
                    code="client_submit_permit_application_info",
                    name="Submit permit application information",
                    description="Confirm your operating address for the MMDA permit application.",
                    sequence_order=1,
                    assignee_type=AssigneeType.CLIENT.value,
                    is_required=True,
                    requires_document=False,
                ),
                dict(
                    code="mmda_permit_filed",
                    name="MMDA permit application filed",
                    description="Staff manually files the permit application with the local MMDA.",
                    sequence_order=2,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=False,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
                dict(
                    code="permit_issued",
                    name="Business operating permit issued",
                    description="Upload the issued business operating permit.",
                    sequence_order=3,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=True,
                    required_document_type=DocumentTypeCode.BUSINESS_OPERATING_PERMIT.value,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
            ],
        ),
        dict(
            code="completed",
            name="Completed",
            sequence_order=6,
            is_gated_by_payment=False,
            deadline_days=None,
            tasks=[
                dict(
                    code="case_finalized",
                    name="Case finalized",
                    description="Final confirmation that all registrations are complete.",
                    sequence_order=1,
                    assignee_type=AssigneeType.STAFF.value,
                    is_required=True,
                    requires_document=False,
                    allowed_transition_roles=STAFF_TASK_ROLES,
                ),
            ],
        ),
    ]


def bank_account_task(sequence_order: int) -> dict:
    """The corporate bank-account step, shared by every workflow. The client
    picks a Ghanaian bank and account details (structured input_schema); staff
    share any bank forms and the client uploads the completed ones through the
    document centre (document_type_code 'bank_form')."""
    from app.workflow.ghana_banks import bank_select_options

    return dict(
        code="open_corporate_bank_account",
        name="Open a corporate bank account",
        description=(
            "Choose a Ghanaian bank and give us the account details below. We'll share any bank "
            "forms you need to sign in your Documents, and you can upload the completed forms back "
            "there. Tell us once the account is open."
        ),
        sequence_order=sequence_order,
        assignee_type=AssigneeType.CLIENT.value,
        is_required=True,
        requires_document=False,
        input_schema=[
            {
                "name": "bank",
                "label": "Bank",
                "type": "select",
                "required": True,
                "placeholder": "Choose a bank",
                "options": bank_select_options(),
            },
            {
                "name": "account_type",
                "label": "Account type",
                "type": "select",
                "required": True,
                "placeholder": "Choose an account type",
                "options": [
                    {"value": "current", "label": "Current account"},
                    {"value": "savings", "label": "Savings account"},
                    {"value": "foreign_currency", "label": "Foreign-currency account"},
                    {"value": "domiciliary", "label": "Domiciliary account"},
                ],
            },
            {
                "name": "account_currency",
                "label": "Account currency",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "GHS", "label": "GHS"},
                    {"value": "USD", "label": "USD"},
                    {"value": "EUR", "label": "EUR"},
                    {"value": "GBP", "label": "GBP"},
                ],
            },
            {"name": "branch", "label": "Preferred branch", "type": "text", "placeholder": "e.g. Accra Main"},
            {
                "name": "num_signatories",
                "label": "Number of signatories",
                "type": "text",
                "placeholder": "e.g. 2",
            },
            {"name": "notes", "label": "Anything else we should know", "type": "textarea"},
        ],
    )


def build_bank_account_stage(sequence_order: int) -> dict:
    """Standalone banking stage for workflows that don't already carry a bank
    task (the foreign/GIPC track embeds its own via bank_account_task)."""
    return dict(
        code="corporate_bank_account",
        sla_hours=168,
        name="Corporate Bank Account",
        sequence_order=sequence_order,
        is_gated_by_payment=False,
        deadline_days=None,
        tasks=[bank_account_task(1)],
    )


def insert_bank_account_stage(stages: list[dict]) -> list[dict]:
    """Insert the banking stage just before 'completed' and renumber (same
    insert-and-renumber approach as build_foreign_stages)."""
    completed_index = next(i for i, s in enumerate(stages) if s["code"] == "completed")
    result = stages[:completed_index] + [build_bank_account_stage(0)] + stages[completed_index:]
    for order, stage in enumerate(result, start=1):
        stage["sequence_order"] = order
    return result


def build_gipc_stage(sequence_order: int) -> dict:
    """GIPC/GIPA registration stage for foreign-participation cases,
    slotted in right after Incorporation."""
    return dict(
        code="gipc_registration",
        sla_hours=240,
        name="GIPC Registration",
        sequence_order=sequence_order,
        is_gated_by_payment=False,
        deadline_days=None,
        tasks=[
            bank_account_task(1),
            dict(
                code="equity_transfer_evidence",
                name="Provide equity transfer evidence",
                description=(
                    "Upload proof that the foreign equity has arrived in Ghana. Cash equity: the "
                    "Bank of Ghana equity confirmation letter your bank obtains after the transfer. "
                    "In-kind equity (machinery, goods): the customs import declaration documents."
                ),
                sequence_order=2,
                assignee_type=AssigneeType.CLIENT.value,
                is_required=True,
                requires_document=True,
                required_document_type=DocumentTypeCode.PROOF_OF_EQUITY.value,
            ),
            dict(
                code="gipc_document_pack",
                name="Assemble GIPC document pack",
                description=(
                    "Checklist: Certificate of Incorporation; company constitution; Form 3; "
                    "beneficial ownership profile; proof of equity; completed GIPC registration forms."
                ),
                sequence_order=3,
                assignee_type=AssigneeType.STAFF.value,
                is_required=True,
                requires_document=False,
                allowed_transition_roles=STAFF_TASK_ROLES,
            ),
            dict(
                code="gipc_submission_filed",
                name="GIPC application submitted",
                description="Staff files the pack with GIPC and tracks the submission reference.",
                sequence_order=4,
                assignee_type=AssigneeType.STAFF.value,
                is_required=True,
                requires_document=False,
                allowed_transition_roles=STAFF_TASK_ROLES,
            ),
            dict(
                code="gipc_certificate_issued",
                name="GIPC certificate issued",
                description="Upload the issued GIPC registration certificate.",
                sequence_order=5,
                assignee_type=AssigneeType.STAFF.value,
                is_required=True,
                requires_document=True,
                required_document_type=DocumentTypeCode.GIPC_CERTIFICATE.value,
                allowed_transition_roles=STAFF_TASK_ROLES,
            ),
        ],
    )


def build_foreign_stages() -> list[dict]:
    """Standard Company Ltd stages with the GIPC stage inserted after
    Incorporation; later stages renumbered."""
    stages = build_stages()
    incorporation_index = next(i for i, s in enumerate(stages) if s["code"] == "incorporation")
    gipc = build_gipc_stage(sequence_order=stages[incorporation_index]["sequence_order"] + 1)
    result = stages[: incorporation_index + 1] + [gipc] + stages[incorporation_index + 1 :]
    for order, stage in enumerate(result, start=1):
        stage["sequence_order"] = order
    return result


def _sync_task_input_schemas(workflow: WorkflowDefinition, stages: list[dict]) -> None:
    desired = {
        task["code"]: task["input_schema"]
        for stage in stages
        for task in stage.get("tasks", [])
        if "input_schema" in task
    }
    if not desired:
        return
    changed = False
    for stage in workflow.stage_definitions:
        for task in stage.task_definitions:
            wanted = desired.get(task.code)
            if wanted is not None and task.input_schema != wanted:
                task.input_schema = wanted
                changed = True
    if changed:
        db.session.commit()


def seed_workflow(entity_type: str, variant: str, stages: list[dict]) -> WorkflowDefinition:
    existing = WorkflowDefinition.query.filter_by(
        entity_type=entity_type, variant=variant, is_active=True
    ).first()
    if existing is not None:
        # Re-running the seed applies input_schema changes to the existing task
        # definitions (by code), so adding a form to a task does not require
        # rebuilding the whole workflow.
        _sync_task_input_schemas(existing, stages)
        return existing

    workflow = WorkflowDefinition(entity_type=entity_type, variant=variant, version=1, is_active=True)
    db.session.add(workflow)
    db.session.flush()

    for stage_data in stages:
        stage_data = dict(stage_data)
        tasks = stage_data.pop("tasks")
        stage = StageDefinition(workflow_definition_id=workflow.id, **stage_data)
        db.session.add(stage)
        db.session.flush()
        for task_data in tasks:
            task_data = dict(task_data)
            task_data.setdefault("allowed_transition_roles", [])
            db.session.add(TaskDefinition(stage_definition_id=stage.id, **task_data))

    db.session.commit()
    return workflow


def seed_company_ltd_workflow() -> WorkflowDefinition:
    return seed_workflow(
        EntityType.COMPANY_LIMITED_BY_SHARES.value,
        "standard",
        insert_bank_account_stage(build_stages()),
    )


def seed_company_ltd_foreign_workflow() -> WorkflowDefinition:
    return seed_workflow(EntityType.COMPANY_LIMITED_BY_SHARES.value, "foreign", build_foreign_stages())

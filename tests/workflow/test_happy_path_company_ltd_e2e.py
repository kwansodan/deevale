import uuid

from app.core.enums import RoleName
from app.core.events.bus import bus
from app.core.events.events import DocumentApproved, PaymentReceived
from app.core.models import AuditLog
from app.workflow.enums import CaseStatus, StageStatus, TaskStatus
from app.workflow.models import BusinessCase, CaseStage, CaseTask
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_approved_document, make_user


def _stage(case_id, code):
    return CaseStage.query.filter_by(business_case_id=case_id, code=code).one()


def _task(stage, code):
    return CaseTask.query.filter_by(case_stage_id=stage.id, code=code).one()


def _complete_client_task(client, headers, case_id, task):
    resp = client.post(f"/cases/{case_id}/tasks/{task.id}/complete", headers=headers, json={})
    assert resp.status_code == 200, resp.get_json()


def _staff_done(client, headers, case_id, task):
    resp = client.post(
        f"/cases/{case_id}/tasks/{task.id}/transition", headers=headers, json={"new_status": "done"}
    )
    assert resp.status_code == 200, resp.get_json()


def _complete_stage(client, headers, case_id, stage):
    resp = client.post(
        f"/cases/{case_id}/stages/{stage.id}/transition", headers=headers, json={"new_status": "completed"}
    )
    assert resp.status_code == 200, resp.get_json()


def test_full_happy_path_walk_company_limited_by_shares(app, client):
    with app.app_context():
        seed_company_ltd_workflow()

        client_user = make_user(email="e2eclient@example.com", roles=[RoleName.CLIENT])
        officer = make_user(email="e2eofficer@example.com", roles=[RoleName.CASE_OFFICER])
        client_headers = auth_headers(client_user)
        staff_headers = auth_headers(officer)

        create_resp = client.post(
            "/cases",
            headers=client_headers,
            json={"entity_type": "company_limited_by_shares", "planned_employees": 2},
        )
        assert create_resp.status_code == 201, create_resp.get_json()
        case_id = create_resp.get_json()["id"]
        case = BusinessCase.query.get(uuid.UUID(case_id))
        assert case.status == CaseStatus.ACTIVE.value

        # --- Stage 1: Name Reservation ---
        stage1 = _stage(case.id, "name_reservation")
        assert stage1.status == StageStatus.IN_PROGRESS.value

        _complete_client_task(client, client_headers, case_id, _task(stage1, "submit_proposed_names"))
        _staff_done(client, staff_headers, case_id, _task(stage1, "orc_name_search"))

        filed_task = _task(stage1, "orc_name_reservation_filed")
        make_approved_document(case, filed_task, officer)
        _staff_done(client, staff_headers, case_id, filed_task)

        _complete_stage(client, staff_headers, case_id, stage1)

        # --- Stage 2: Incorporation (payment-gated) ---
        stage2 = _stage(case.id, "incorporation")
        assert stage2.status == StageStatus.BLOCKED_ON_PAYMENT.value

        bus.dispatch(PaymentReceived(case_id=case.id, invoice_id=uuid.uuid4(), payment_id=uuid.uuid4()))
        from app.extensions import db

        db.session.commit()

        stage2 = _stage(case.id, "incorporation")
        assert stage2.status == StageStatus.IN_PROGRESS.value

        kyc_task = _task(stage2, "client_submit_incorporation_docs")
        kyc_doc = make_approved_document(case, kyc_task, client_user)
        _complete_client_task(client, client_headers, case_id, kyc_task)
        assert kyc_task.status == TaskStatus.AWAITING_REVIEW.value
        bus.dispatch(DocumentApproved(case_id=case.id, document_id=kyc_doc.id, task_id=kyc_task.id))
        db.session.commit()
        assert kyc_task.status == TaskStatus.DONE.value

        _staff_done(client, staff_headers, case_id, _task(stage2, "orc_incorporation_filed"))

        for code in ("certificate_of_incorporation_issued", "form_3_issued", "constitution_issued"):
            task = _task(stage2, code)
            make_approved_document(case, task, officer)
            _staff_done(client, staff_headers, case_id, task)

        _complete_stage(client, staff_headers, case_id, stage2)

        # --- Stage 3: Tax Registration ---
        stage3 = _stage(case.id, "tax_registration")
        assert stage3.status == StageStatus.IN_PROGRESS.value
        _complete_client_task(client, client_headers, case_id, _task(stage3, "client_submit_tax_info"))
        _staff_done(client, staff_headers, case_id, _task(stage3, "gra_tin_filed"))
        tin_task = _task(stage3, "tin_certificate_issued")
        make_approved_document(case, tin_task, officer)
        _staff_done(client, staff_headers, case_id, tin_task)
        _complete_stage(client, staff_headers, case_id, stage3)

        # --- Stage 4: SSNIT Registration ---
        stage4 = _stage(case.id, "ssnit_registration")
        assert stage4.status == StageStatus.IN_PROGRESS.value
        _complete_client_task(client, client_headers, case_id, _task(stage4, "client_submit_employee_data"))
        _staff_done(client, staff_headers, case_id, _task(stage4, "ssnit_registration_filed"))
        ssnit_task = _task(stage4, "ssnit_certificate_issued")
        make_approved_document(case, ssnit_task, officer)
        _staff_done(client, staff_headers, case_id, ssnit_task)
        _complete_stage(client, staff_headers, case_id, stage4)

        # --- Stage 5: Business Operating Permit ---
        stage5 = _stage(case.id, "business_operating_permit")
        assert stage5.status == StageStatus.IN_PROGRESS.value
        _complete_client_task(
            client, client_headers, case_id, _task(stage5, "client_submit_permit_application_info")
        )
        _staff_done(client, staff_headers, case_id, _task(stage5, "mmda_permit_filed"))
        permit_task = _task(stage5, "permit_issued")
        make_approved_document(case, permit_task, officer)
        _staff_done(client, staff_headers, case_id, permit_task)
        _complete_stage(client, staff_headers, case_id, stage5)

        # --- Stage 6: Completed ---
        stage6 = _stage(case.id, "completed")
        assert stage6.status == StageStatus.IN_PROGRESS.value
        _staff_done(client, staff_headers, case_id, _task(stage6, "case_finalized"))
        _complete_stage(client, staff_headers, case_id, stage6)

        case = BusinessCase.query.get(case.id)
        assert case.status == CaseStatus.COMPLETED.value

        # Audit trail sanity: every stage/task transition and the case creation wrote an entry.
        assert AuditLog.query.filter_by(action="case_created").count() == 1
        assert AuditLog.query.filter_by(action="stage_transition").count() >= 6
        assert AuditLog.query.filter_by(action="task_transition").count() >= 15

        get_resp = client.get(f"/cases/{case_id}", headers=client_headers)
        assert get_resp.status_code == 200
        assert get_resp.get_json()["status"] == "completed"

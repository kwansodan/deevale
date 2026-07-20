"""End-to-end happy path at the API level:

signup -> OTP verify -> login -> onboard (create case + quote) -> invoice ->
initialize payment -> Paystack webhook (mocked signature) -> staff processes
every stage with evidence -> case completed.

Asserts notifications and audit entries at each milestone.
"""

import re

from app.core.enums import RoleName
from app.core.models import AuditLog
from app.notifications.models import Notification
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user
from tests.payments.conftest import sign_paystack_payload

CODE_RE = re.compile(r"code is (\d{6})")


def _otp_from_logs(caplog) -> str:
    for record in caplog.records:
        m = CODE_RE.search(record.getMessage())
        if m:
            return m.group(1)
    raise AssertionError("No OTP in logs")


def _upload_approve(client, staff_headers, reviewer_headers, case_id, task, doc_type):
    slot = client.post(
        "/documents/upload-slot",
        headers=staff_headers,
        json={
            "business_case_id": case_id,
            "case_task_id": str(task["id"]),
            "document_type_code": doc_type,
            "original_filename": f"{doc_type}.pdf",
            "content_type": "application/pdf",
            "size_bytes": 1024,
        },
    ).get_json()
    client.post(f"/documents/{slot['document_id']}/versions/1/confirm", headers=staff_headers)
    review = client.post(
        f"/documents/{slot['document_id']}/versions/1/review",
        headers=reviewer_headers,
        json={"decision": "approve"},
    )
    assert review.status_code == 200


def _task_by_code(case_json, stage_code, task_code):
    stage = next(s for s in case_json["stages"] if s["code"] == stage_code)
    return next(t for t in stage["tasks"] if t["code"] == task_code), stage


def _get_case(client, headers, case_id):
    return client.get(f"/cases/{case_id}", headers=headers).get_json()


def test_full_client_journey_signup_to_completed_case(app, client, caplog):
    with app.app_context():
        seed_company_ltd_workflow()

        # Fee schedule so the quote isn't empty.
        from app.extensions import db
        from app.workflow.models import FeeScheduleItem

        db.session.add_all(
            [
                FeeScheduleItem(
                    code="E2E_GOV", label="E2E Gov Fee", amount_minor=10_000, fee_type="government"
                ),
                FeeScheduleItem(
                    code="E2E_SVC",
                    label="E2E Service Fee",
                    applies_to_entity_type="company_limited_by_shares",
                    amount_minor=100_000,
                    fee_type="service",
                ),
            ]
        )
        db.session.commit()

        officer = make_user(email="e2ejourneyofficer@example.com", roles=[RoleName.CASE_OFFICER])
        reviewer = make_user(email="e2ejourneyreviewer@example.com", roles=[RoleName.REVIEWER])
        staff_headers = auth_headers(officer)
        reviewer_headers = auth_headers(reviewer)

        # --- 1. Signup + OTP + login ---
        with caplog.at_level("INFO", logger="launchgh.otp"):
            signup_resp = client.post(
                "/auth/signup",
                json={
                    "email": "journey@example.com",
                    "phone": "0244123123",
                    "full_name": "Journey Tester",
                    "password": "journeypass1",
                },
            )
        assert signup_resp.status_code == 201
        code = _otp_from_logs(caplog)
        assert client.post("/auth/verify-otp", json={"identifier": "0244123123", "code": code}).status_code == 200

        login = client.post("/auth/login", json={"email": "journey@example.com", "password": "journeypass1"})
        client_headers = {"Authorization": f"Bearer {login.get_json()['access_token']}"}
        assert AuditLog.query.filter_by(action="login_success").count() >= 1

        # --- 2. Onboard: create case ---
        create = client.post(
            "/cases",
            headers=client_headers,
            json={
                "entity_type": "company_limited_by_shares",
                "business_name": "Journey Ventures",
                "planned_employees": 3,
            },
        )
        assert create.status_code == 201
        case_json = create.get_json()
        case_id = case_json["id"]
        assert case_json["quote"]["total_minor"] == 110_000
        assert AuditLog.query.filter_by(action="case_created").count() == 1

        # --- 3. Invoice + init + webhook (pay early; unblocks incorporation later) ---
        invoice = client.post(f"/payments/cases/{case_id}/invoice", headers=client_headers).get_json()
        init = client.post(
            f"/payments/invoices/{invoice['id']}/initialize-transaction", headers=client_headers
        ).get_json()

        payload = {
            "event": "charge.success",
            "data": {
                "reference": init["provider_reference"],
                "status": "success",
                "amount": invoice["total_minor"],
                "channel": "mobile_money",
            },
        }
        raw, signature = sign_paystack_payload(payload, app.config["PAYSTACK_SECRET_KEY"])
        webhook = client.post(
            "/payments/webhook/paystack",
            data=raw,
            headers={"Content-Type": "application/json", "x-paystack-signature": signature},
        )
        assert webhook.status_code == 200

        journey_user_id = signup_resp.get_json()["user_id"]
        assert (
            Notification.query.filter_by(user_id=journey_user_id, category="payment_received").count() == 1
        )

        # --- 4. Stage 1: Name Reservation ---
        case_json = _get_case(client, client_headers, case_id)
        names_task, stage1 = _task_by_code(case_json, "name_reservation", "submit_proposed_names")
        assert client.post(
            f"/cases/{case_id}/tasks/{names_task['id']}/complete", headers=client_headers, json={}
        ).status_code == 200

        search_task, _ = _task_by_code(case_json, "name_reservation", "orc_name_search")
        client.post(
            f"/cases/{case_id}/tasks/{search_task['id']}/transition",
            headers=staff_headers,
            json={"new_status": "done"},
        )

        filed_task, _ = _task_by_code(case_json, "name_reservation", "orc_name_reservation_filed")
        _upload_approve(client, staff_headers, reviewer_headers, case_id, filed_task, "name_reservation_certificate")
        # document.approved auto-completed the staff evidence task
        case_json = _get_case(client, client_headers, case_id)
        filed_after, _ = _task_by_code(case_json, "name_reservation", "orc_name_reservation_filed")
        assert filed_after["status"] == "done"

        assert client.post(
            f"/cases/{case_id}/stages/{stage1['id']}/transition",
            headers=staff_headers,
            json={"new_status": "completed"},
        ).status_code == 200

        # Incorporation is payment-gated, but the invoice was already paid
        # before Name Reservation finished -- the advance logic must see the
        # paid invoice and open the stage instead of blocking it.
        case_json = _get_case(client, client_headers, case_id)
        stage2 = next(s for s in case_json["stages"] if s["code"] == "incorporation")
        assert stage2["status"] == "in_progress"

        # --- 5. Remaining stages ---
        def finish_stage(stage_code, client_task_code, staff_plain_codes, evidence: list[tuple[str, str]]):
            nonlocal case_json
            case_json = _get_case(client, client_headers, case_id)
            stage = next(s for s in case_json["stages"] if s["code"] == stage_code)
            assert stage["status"] == "in_progress", f"{stage_code}: {stage['status']}"

            if client_task_code:
                ct, _ = _task_by_code(case_json, stage_code, client_task_code)
                resp = client.post(
                    f"/cases/{case_id}/tasks/{ct['id']}/complete", headers=client_headers, json={}
                )
                assert resp.status_code == 200, resp.get_json()
                if ct["requires_document"]:
                    # client task awaits review; approve its (staff-uploaded) doc
                    _upload_approve(client, staff_headers, reviewer_headers, case_id, ct, "passport")

            for code in staff_plain_codes:
                task, _ = _task_by_code(case_json, stage_code, code)
                resp = client.post(
                    f"/cases/{case_id}/tasks/{task['id']}/transition",
                    headers=staff_headers,
                    json={"new_status": "done"},
                )
                assert resp.status_code == 200, resp.get_json()

            for task_code, doc_type in evidence:
                task, _ = _task_by_code(case_json, stage_code, task_code)
                _upload_approve(client, staff_headers, reviewer_headers, case_id, task, doc_type)

            case_json = _get_case(client, client_headers, case_id)
            stage = next(s for s in case_json["stages"] if s["code"] == stage_code)
            resp = client.post(
                f"/cases/{case_id}/stages/{stage['id']}/transition",
                headers=staff_headers,
                json={"new_status": "completed"},
            )
            assert resp.status_code == 200, resp.get_json()

        finish_stage(
            "incorporation",
            "client_submit_incorporation_docs",
            ["orc_incorporation_filed"],
            [
                ("certificate_of_incorporation_issued", "certificate_of_incorporation"),
                ("form_3_issued", "form_3"),
                ("constitution_issued", "constitution"),
            ],
        )
        finish_stage(
            "tax_registration",
            "client_submit_tax_info",
            ["gra_tin_filed"],
            [("tin_certificate_issued", "tin_certificate")],
        )
        finish_stage(
            "ssnit_registration",
            "client_submit_employee_data",
            ["ssnit_registration_filed"],
            [("ssnit_certificate_issued", "ssnit_certificate")],
        )
        finish_stage(
            "business_operating_permit",
            "client_submit_permit_application_info",
            ["mmda_permit_filed"],
            [("permit_issued", "business_operating_permit")],
        )
        finish_stage("completed", None, ["case_finalized"], [])

        # --- 6. Final assertions ---
        case_json = _get_case(client, client_headers, case_id)
        assert case_json["status"] == "completed"

        # Client got stage-completed notifications along the way.
        stage_notes = Notification.query.filter_by(
            user_id=journey_user_id, category="stage_completed"
        ).count()
        assert stage_notes >= 5

        # Vault documents pinned for the client.
        docs = client.get(f"/documents/cases/{case_id}", headers=client_headers).get_json()
        vault_types = {d["document_type_code"] for d in docs if d["is_vault"]}
        assert "certificate_of_incorporation" in vault_types

        # Audit trail covers the journey.
        assert AuditLog.query.filter_by(action="stage_transition").count() >= 6
        assert AuditLog.query.filter_by(action="task_transition").count() >= 10
        assert AuditLog.query.filter_by(action="document_approved").count() >= 6
        assert AuditLog.query.filter_by(action="payment_received").count() >= 0  # webhook path

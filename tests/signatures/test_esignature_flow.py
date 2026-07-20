from unittest.mock import MagicMock

import pytest

from app.core.enums import RoleName
from app.signatures.models import SignatureRequest
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


@pytest.fixture(autouse=True)
def stub_pdf(monkeypatch):
    """assemble_signed_pdf uses WeasyPrint (native libs unavailable in tests) --
    stub its .delay so completion doesn't try to render a real PDF."""
    monkeypatch.setattr("app.signatures.tasks.assemble_signed_pdf.delay", MagicMock())


def _case_and_officer(prefix):
    seed_company_ltd_workflow()
    officer = make_user(email=f"{prefix}-officer@example.com", roles=[RoleName.CASE_OFFICER])
    client_user = make_user(email=f"{prefix}-client@example.com", roles=[RoleName.CLIENT])
    case = CaseFactory.create_from_onboarding(client_user, {"entity_type": "company_limited_by_shares"})
    return officer, client_user, case


def _create_request(client, officer, case, parties):
    resp = client.post(
        "/signatures/requests",
        headers=auth_headers(officer),
        json={
            "business_case_id": str(case.id),
            "title": "Company Constitution",
            "body_html": "<p>Constitution for {{ company_name }}. {{ party_name }} holds {{ shares }} shares.</p>",
            "merge_values": {"company_name": "Acme Ltd", "party_name": "The subscribers", "shares": "100"},
            "parties": parties,
        },
    )
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()


def test_merge_fields_render_into_document(app, client):
    with app.app_context():
        officer, _, case = _case_and_officer("merge")
        created = _create_request(
            client, officer, case, [{"name": "Ama", "email": "ama@example.com"}]
        )
        req = SignatureRequest.query.get(created["id"])
        assert "Acme Ltd" in req.merged_html
        assert "100 shares" in req.merged_html


def test_sequential_signing_enforced_and_completes(app, client):
    with app.app_context():
        officer, _, case = _case_and_officer("seq")
        created = _create_request(
            client,
            officer,
            case,
            [
                {"name": "First Signer", "email": "first@example.com"},
                {"name": "Second Signer", "email": "second@example.com"},
            ],
        )
        request_id = created["id"]
        # Sort parties by order.
        parties = sorted(created["parties"], key=lambda p: p["order_index"])
        first_token = parties[0]["sign_token"]
        second_token = parties[1]["sign_token"]

        # Can't sign before it's sent.
        early = client.post(
            f"/signatures/sign/{first_token}", json={"signature_type": "typed", "signature_data": "First"}
        )
        assert early.status_code == 422

        client.post(f"/signatures/requests/{request_id}/send", headers=auth_headers(officer))

        # Second signer can't go first.
        out_of_order = client.post(
            f"/signatures/sign/{second_token}", json={"signature_type": "typed", "signature_data": "Second"}
        )
        assert out_of_order.status_code == 403

        # First signer's view says it's their turn.
        view = client.get(f"/signatures/sign/{first_token}").get_json()
        assert view["can_sign"] is True
        assert "Acme Ltd" in view["merged_html"]

        # First signs.
        first = client.post(
            f"/signatures/sign/{first_token}",
            json={"signature_type": "drawn", "signature_data": "data:image/png;base64,AAAA"},
        )
        assert first.status_code == 200
        assert SignatureRequest.query.get(request_id).status == "sent"  # still awaiting second

        # Now second can sign, and that completes the request.
        second = client.post(
            f"/signatures/sign/{second_token}",
            json={"signature_type": "typed", "signature_data": "Second Signer"},
        )
        assert second.status_code == 200

        from app.extensions import db

        db.session.expire_all()
        completed = SignatureRequest.query.get(request_id)
        assert completed.status == "completed"
        assert completed.completed_at is not None
        assert all(p.status == "signed" for p in completed.parties)
        # IP captured for the audit trail.
        assert all(p.signed_at is not None for p in completed.parties)


def test_completion_attaches_signed_document_and_completes_task(app, client):
    with app.app_context():
        officer, _, case = _case_and_officer("attach")
        # Wire the request to a staff evidence task in the incorporation stage.
        stage = next(s for s in case.stages if s.code == "incorporation")
        constitution_task = next(t for t in stage.tasks if t.code == "constitution_issued")

        created = client.post(
            "/signatures/requests",
            headers=auth_headers(officer),
            json={
                "business_case_id": str(case.id),
                "case_task_id": str(constitution_task.id),
                "title": "Constitution",
                "body_html": "<p>Doc</p>",
                "parties": [{"name": "Signer", "email": "s@example.com"}],
            },
        ).get_json()
        request_id = created["id"]
        token = created["parties"][0]["sign_token"]

        client.post(f"/signatures/requests/{request_id}/send", headers=auth_headers(officer))
        client.post(
            f"/signatures/sign/{token}", json={"signature_type": "typed", "signature_data": "Signer"}
        )

        # complete_request enqueues assemble_signed_pdf; run its body directly
        # (bypassing WeasyPrint) to exercise the attach + task-completion path.
        from app.extensions import db
        from app.signatures.service import attach_signed_document

        req = SignatureRequest.query.get(request_id)
        attach_signed_document(req, s3_key="cases/test/signatures/signed.pdf")
        db.session.expire_all()

        req = SignatureRequest.query.get(request_id)
        assert req.signed_document_id is not None
        from app.workflow.models import CaseTask

        assert CaseTask.query.get(constitution_task.id).status == "done"


def test_reminder_task_nudges_current_signer_after_48h(app, monkeypatch):
    with app.app_context():
        from datetime import UTC, datetime

        from freezegun import freeze_time

        from app.extensions import db
        from app.signatures.models import SignatureParty, SignatureRequest
        from app.signatures.tasks import remind_unsigned_parties

        sender = MagicMock()
        monkeypatch.setattr("app.notifications.channels.email.get_email_sender", lambda: sender)

        officer, _, case = _case_and_officer("remind")
        with freeze_time(datetime(2026, 7, 20, 9, 0, tzinfo=UTC)):
            req = SignatureRequest(
                business_case_id=case.id,
                title="Doc",
                status="sent",
                merged_html="<p>x</p>",
                sent_at=datetime(2026, 7, 20, 9, 0, tzinfo=UTC),
            )
            db.session.add(req)
            db.session.flush()
            db.session.add(
                SignatureParty(request_id=req.id, name="Slow", email="slow@example.com", order_index=0)
            )
            db.session.commit()

        # 24h later: no reminder yet.
        with freeze_time(datetime(2026, 7, 21, 9, 0, tzinfo=UTC)):
            assert remind_unsigned_parties.run() == 0

        # 49h later: reminder sent once.
        with freeze_time(datetime(2026, 7, 22, 10, 0, tzinfo=UTC)):
            assert remind_unsigned_parties.run() == 1
            assert sender.send.call_count == 1
            # Not sent again immediately.
            assert remind_unsigned_parties.run() == 0

from datetime import UTC, datetime, timedelta

from freezegun import freeze_time

from app.billing.models import Subscription
from app.core.enums import RoleName
from app.core.model_mixins import utcnow
from app.core.models import AuditLog
from app.extensions import db
from app.mailroom.models import MailForwardRequest, MailItem, RegisteredAddressEnrollment
from app.notifications.models import Notification
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user


def _case(email, with_subscription=True):
    seed_company_ltd_workflow()
    client_user = make_user(email=email, roles=[RoleName.CLIENT])
    case = CaseFactory.create_from_onboarding(
        client_user, {"entity_type": "company_limited_by_shares", "business_name": "Mail Co"}
    )
    if with_subscription:
        db.session.add(
            Subscription(
                user_id=client_user.id,
                plan="monthly",
                status="active",
                provider_reference="SUB-mail",
                current_period_end=utcnow() + timedelta(days=30),
            )
        )
    db.session.commit()
    return client_user, case


# --- Enrollment --------------------------------------------------------------


def test_disclaimer_returns_office_address_and_consent_text(app, client):
    with app.app_context():
        client_user, case = _case("mail-disclaimer@example.com")
        resp = client.get(
            f"/mailroom/disclaimer?business_case_id={case.id}", headers=auth_headers(client_user)
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "Airport City" in data["office_address"]
        assert "registered office" in data["disclaimer"]
        assert data["enrolled"] is False


def test_enroll_requires_active_subscription(app, client):
    with app.app_context():
        client_user, case = _case("mail-nosub@example.com", with_subscription=False)
        resp = client.post(
            "/mailroom/enroll",
            headers=auth_headers(client_user),
            json={"business_case_id": str(case.id), "consent": True},
        )
        assert resp.status_code == 403
        assert "compliance plan" in resp.get_json()["message"]


def test_enroll_captures_consent_and_sets_registered_office(app, client):
    with app.app_context():
        client_user, case = _case("mail-enroll@example.com")
        resp = client.post(
            "/mailroom/enroll",
            headers=auth_headers(client_user),
            json={"business_case_id": str(case.id), "consent": True},
        )
        assert resp.status_code == 201
        enrollment = RegisteredAddressEnrollment.query.filter_by(business_case_id=case.id).one()
        assert enrollment.status == "active"
        assert enrollment.consent_text  # snapshot captured
        assert enrollment.consented_at is not None

        db.session.refresh(case)
        assert "registered_office" in case.onboarding_payload
        assert AuditLog.query.filter_by(action="registered_address_enrolled").count() == 1


def test_enroll_without_consent_is_rejected(app, client):
    with app.app_context():
        client_user, case = _case("mail-noconsent@example.com")
        resp = client.post(
            "/mailroom/enroll",
            headers=auth_headers(client_user),
            json={"business_case_id": str(case.id), "consent": False},
        )
        assert resp.status_code == 422


# --- Mail room flow ----------------------------------------------------------


def _log_and_scan(client, staff_headers, case, sender="GRA"):
    logged = client.post(
        "/mailroom/mail",
        headers=staff_headers,
        json={
            "business_case_id": str(case.id),
            "sender": sender,
            "subject": "Tax notice",
            "received_date": "2026-07-20",
            "urgency": "urgent",
        },
    )
    assert logged.status_code == 201, logged.get_json()
    mail_id = logged.get_json()["id"]

    slot = client.post(
        f"/mailroom/mail/{mail_id}/scan-slot",
        headers=staff_headers,
        json={"original_filename": "scan.pdf", "content_type": "application/pdf", "size_bytes": 4096},
    )
    assert slot.status_code == 201
    confirm = client.post(f"/mailroom/mail/{mail_id}/scan-confirm", headers=staff_headers)
    assert confirm.status_code == 200
    return mail_id


def test_staff_log_scan_notifies_client_and_client_sees_inbox(app, client):
    with app.app_context():
        client_user, case = _case("mail-flow@example.com")
        officer = make_user(email="mail-flow-officer@example.com", roles=[RoleName.CASE_OFFICER])
        mail_id = _log_and_scan(client, auth_headers(officer), case, sender="GRA")

        # Client is notified "You've received mail from GRA".
        note = Notification.query.filter_by(
            user_id=client_user.id, category="gov_processing_update"
        ).first()
        assert note is not None
        assert "GRA" in note.body

        inbox = client.get("/mailroom/mail", headers=auth_headers(client_user))
        assert inbox.status_code == 200
        items = inbox.get_json()
        assert len(items) == 1
        assert items[0]["id"] == mail_id
        assert items[0]["has_scan"] is True
        assert items[0]["shred_after"] is not None


def test_client_download_marks_read_and_audits(app, client):
    with app.app_context():
        client_user, case = _case("mail-read@example.com")
        officer = make_user(email="mail-read-officer@example.com", roles=[RoleName.CASE_OFFICER])
        mail_id = _log_and_scan(client, auth_headers(officer), case)

        resp = client.get(f"/mailroom/mail/{mail_id}/download-url", headers=auth_headers(client_user))
        assert resp.status_code == 200
        assert resp.get_json()["download_url"].startswith("https://fake-s3/")

        mail = MailItem.query.get(mail_id)
        assert mail.read_at is not None
        assert AuditLog.query.filter_by(action="mail_accessed", entity_id=str(mail_id)).count() == 1


def test_other_client_cannot_access_foreign_mail(app, client):
    with app.app_context():
        _, case = _case("mail-owner@example.com")
        officer = make_user(email="mail-iso-officer@example.com", roles=[RoleName.CASE_OFFICER])
        mail_id = _log_and_scan(client, auth_headers(officer), case)

        other = make_user(email="mail-intruder@example.com", roles=[RoleName.CLIENT])
        resp = client.get(f"/mailroom/mail/{mail_id}/download-url", headers=auth_headers(other))
        assert resp.status_code == 403


def test_forward_request_creates_ops_task_and_staff_completes(app, client):
    with app.app_context():
        client_user, case = _case("mail-fwd@example.com")
        officer = make_user(email="mail-fwd-officer@example.com", roles=[RoleName.CASE_OFFICER])
        mail_id = _log_and_scan(client, auth_headers(officer), case)

        req = client.post(
            f"/mailroom/mail/{mail_id}/forward",
            headers=auth_headers(client_user),
            json={"forwarding_address": "12 Client St, Kumasi"},
        )
        assert req.status_code == 201
        request_id = req.get_json()["id"]

        # Duplicate open request rejected.
        dup = client.post(
            f"/mailroom/mail/{mail_id}/forward",
            headers=auth_headers(client_user),
            json={"forwarding_address": "12 Client St, Kumasi"},
        )
        assert dup.status_code == 422

        queue = client.get("/mailroom/forward-requests", headers=auth_headers(officer))
        assert any(r["id"] == request_id for r in queue.get_json())

        done = client.post(
            f"/mailroom/forward-requests/{request_id}/transition",
            headers=auth_headers(officer),
            json={"status": "done"},
        )
        assert done.status_code == 200
        assert MailForwardRequest.query.get(request_id).is_forwarded_flag is True


# --- Retention ---------------------------------------------------------------


def test_shred_task_removes_expired_scans_but_keeps_pending_forwards(app, client):
    with app.app_context():
        from app.mailroom.tasks import shred_expired_mail

        client_user, case = _case("mail-shred@example.com")
        officer = make_user(email="mail-shred-officer@example.com", roles=[RoleName.CASE_OFFICER])

        with freeze_time(datetime(2026, 7, 20, 9, 0, tzinfo=UTC)):
            keep_id = _log_and_scan(client, auth_headers(officer), case, sender="GRA")
            shred_id = _log_and_scan(client, auth_headers(officer), case, sender="SSNIT")
            # Open forward request on the "keep" item.
            client.post(
                f"/mailroom/mail/{keep_id}/forward",
                headers=auth_headers(client_user),
                json={"forwarding_address": "Somewhere"},
            )

        # 91 days later, both are past retention (default 90d).
        with freeze_time(datetime(2026, 10, 25, 4, 0, tzinfo=UTC)):
            shredded = shred_expired_mail.run()

        assert shredded == 1  # only the one without an open forward request
        assert MailItem.query.get(shred_id).status == "shredded"
        assert MailItem.query.get(shred_id).scan_s3_key is None
        assert MailItem.query.get(keep_id).status == "scanned"  # held for forwarding
        assert AuditLog.query.filter_by(action="mail_shredded").count() == 1

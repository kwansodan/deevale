import uuid

import pytest

from app.core.enums import RoleName
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import auth_headers, make_user
from tests.partners.conftest import api_headers


@pytest.fixture(autouse=True)
def _seed(app):
    with app.app_context():
        seed_company_ltd_workflow()
        yield


# --- API-key auth & scopes ---------------------------------------------------


def test_missing_key_is_unauthorized(app, client):
    with app.app_context():
        resp = client.get("/api/partner/v1/cases")
        assert resp.status_code == 401


def test_invalid_key_is_unauthorized(app, client):
    with app.app_context():
        resp = client.get("/api/partner/v1/cases", headers=api_headers("sk_partner_pk_bogus.xxxx"))
        assert resp.status_code == 401


def test_scope_enforced(app, client, partner_factory):
    with app.app_context():
        _, key = partner_factory(slug="readonly", scopes=("cases:read",))
        # cases:read key can list...
        assert client.get("/api/partner/v1/cases", headers=api_headers(key)).status_code == 200
        # ...but cannot create (needs cases:write).
        resp = client.post(
            "/api/partner/v1/cases",
            headers=api_headers(key),
            json={
                "client": {"full_name": "X Y", "email": "x@example.com", "phone": "+233240000000"},
                "entity_type": "company_limited_by_shares",
            },
        )
        assert resp.status_code == 403


def test_revoked_key_rejected(app, client, partner_factory):
    with app.app_context():
        from app.extensions import db
        from app.partners.models import PartnerApiKey

        partner, key = partner_factory(slug="revoked")
        PartnerApiKey.query.filter_by(partner_id=partner.id).update({"is_active": False})
        db.session.commit()
        assert client.get("/api/partner/v1/cases", headers=api_headers(key)).status_code == 401


# --- Case creation & retrieval -----------------------------------------------


def test_create_case_on_behalf_of_client_provisions_user(app, client, partner_factory):
    with app.app_context():
        from app.auth.models import User

        partner, key = partner_factory()
        resp = client.post(
            "/api/partner/v1/cases",
            headers=api_headers(key),
            json={
                "client": {"full_name": "Ama Owusu", "email": "ama-partner@example.com", "phone": "+233241111111"},
                "entity_type": "company_limited_by_shares",
                "business_name": "Ama Ventures",
            },
        )
        assert resp.status_code == 201, resp.get_json()
        data = resp.get_json()
        assert data["case_number"].startswith("LGH-")
        assert len(data["stages"]) == 6

        # Client user was created, unverified.
        user = User.query.filter_by(email="ama-partner@example.com").first()
        assert user is not None
        assert user.is_email_verified is False

        # Case is tagged to the partner and visible only to them.
        from app.workflow.models import BusinessCase

        case = BusinessCase.query.get(uuid.UUID(data["id"]))
        assert case.partner_id == partner.id


def test_partner_cannot_see_another_partners_case(app, client, partner_factory):
    with app.app_context():
        _, key_a = partner_factory(slug="firm-a")
        _, key_b = partner_factory(slug="firm-b")

        created = client.post(
            "/api/partner/v1/cases",
            headers=api_headers(key_a),
            json={
                "client": {"full_name": "Client A", "email": "ca@example.com", "phone": "+233242222222"},
                "entity_type": "company_limited_by_shares",
            },
        ).get_json()

        # Firm B can't fetch firm A's case.
        resp = client.get(f"/api/partner/v1/cases/{created['id']}", headers=api_headers(key_b))
        assert resp.status_code == 404
        # And it doesn't appear in B's list.
        assert client.get("/api/partner/v1/cases", headers=api_headers(key_b)).get_json() == []


def test_get_case_returns_stage_tree(app, client, partner_factory):
    with app.app_context():
        _, key = partner_factory()
        created = client.post(
            "/api/partner/v1/cases",
            headers=api_headers(key),
            json={
                "client": {"full_name": "Tree Client", "email": "tree@example.com", "phone": "+233243333333"},
                "entity_type": "company_limited_by_shares",
            },
        ).get_json()

        resp = client.get(f"/api/partner/v1/cases/{created['id']}", headers=api_headers(key))
        assert resp.status_code == 200
        stages = resp.get_json()["stages"]
        assert any(s["code"] == "name_reservation" for s in stages)
        assert all("tasks" in s for s in stages)


# --- Webhooks ----------------------------------------------------------------


def test_webhook_subscribe_and_event_queues_signed_delivery(app, client, partner_factory, monkeypatch):
    with app.app_context():
        from unittest.mock import MagicMock

        from app.extensions import db
        from app.partners.models import PartnerWebhookDelivery

        deliver = MagicMock()
        monkeypatch.setattr("app.partners.tasks.deliver_webhook.delay", deliver)

        partner, key = partner_factory()
        sub = client.post(
            "/api/partner/v1/webhooks",
            headers=api_headers(key),
            json={"url": "https://firm.example.com/hooks", "event_types": ["case.created"]},
        )
        assert sub.status_code == 201
        assert sub.get_json()["secret"]  # returned once

        # Creating a case fires case.created -> queues a delivery.
        client.post(
            "/api/partner/v1/cases",
            headers=api_headers(key),
            json={
                "client": {"full_name": "Hooked", "email": "hook@example.com", "phone": "+233244444444"},
                "entity_type": "company_limited_by_shares",
            },
        )
        db.session.expire_all()
        deliveries = PartnerWebhookDelivery.query.filter_by(event_type="case.created").all()
        assert len(deliveries) == 1
        assert deliveries[0].payload["event"] == "case.created"
        assert deliver.delay.called or deliver.called


def test_webhook_delivery_signs_payload_and_marks_delivered(app, partner_factory, monkeypatch):
    with app.app_context():
        from app.extensions import db
        from app.partners.models import PartnerWebhook, PartnerWebhookDelivery
        from app.partners.tasks import deliver_webhook
        from app.partners.webhooks import delivery_body, sign_payload

        partner, _ = partner_factory()
        webhook = PartnerWebhook(
            partner_id=partner.id, url="https://firm.example.com/hooks", secret="s3cr3t", event_types=["case.created"]
        )
        db.session.add(webhook)
        db.session.flush()
        delivery = PartnerWebhookDelivery(
            webhook_id=webhook.id, event_type="case.created", payload={"event": "case.created", "case_id": "abc"}
        )
        db.session.add(delivery)
        db.session.commit()

        captured = {}

        class FakeResponse:
            status_code = 200

            def raise_for_status(self):
                pass

        def fake_post(url, data=None, headers=None, timeout=None):
            captured["url"] = url
            captured["signature"] = headers["X-Deevale-Signature"]
            captured["body"] = data
            return FakeResponse()

        monkeypatch.setattr("requests.post", fake_post)
        deliver_webhook.run(str(delivery.id))

        db.session.expire_all()
        assert PartnerWebhookDelivery.query.get(delivery.id).status == "delivered"
        # Signature matches HMAC of the exact body with the webhook secret.
        expected = sign_payload("s3cr3t", delivery_body(PartnerWebhookDelivery.query.get(delivery.id)))
        assert captured["signature"] == expected


# --- Admin management --------------------------------------------------------


def test_admin_creates_partner_and_key_shown_once(app, client):
    with app.app_context():
        admin = make_user(email="partner-admin@example.com", roles=[RoleName.ADMIN])
        create = client.post(
            "/admin/partners",
            headers=auth_headers(admin),
            json={"name": "New Firm", "slug": "new-firm", "accent_color": "#8B0000"},
        )
        assert create.status_code == 201
        partner_id = create.get_json()["id"]

        key_resp = client.post(
            f"/admin/partners/{partner_id}/keys",
            headers=auth_headers(admin),
            json={"name": "prod", "scopes": ["cases:read", "cases:write"]},
        )
        assert key_resp.status_code == 201
        plaintext = key_resp.get_json()["plaintext_key"]
        assert plaintext.startswith("sk_partner_")

        # The plaintext is never returned again by the list endpoint.
        listed = client.get(f"/admin/partners/{partner_id}/keys", headers=auth_headers(admin))
        assert all("plaintext_key" not in k for k in listed.get_json())

        # The freshly minted key actually authenticates.
        assert client.get("/api/partner/v1/cases", headers=api_headers(plaintext)).status_code == 200


def test_non_admin_cannot_manage_partners(app, client):
    with app.app_context():
        officer = make_user(email="partner-officer@example.com", roles=[RoleName.CASE_OFFICER])
        assert client.get("/admin/partners", headers=auth_headers(officer)).status_code == 403
